const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const dbName = process.env.DB_NAME || 'mobora';

let pool;

async function initializeDatabase() {
  try {
    // 1. Connect without selecting database to ensure it exists
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();
    
    // 2. Initialize connection pool with database selected
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`[Database] Connected to MySQL database "${dbName}"`);

    // Dynamic schema migration: drop tables if old schema is detected
    const schemaCheckConn = await pool.getConnection();
    try {
      const checkColumnSql = `
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'chat_id'
      `;
      const [columns] = await schemaCheckConn.query(checkColumnSql, [dbName]);
      if (columns.length === 0) {
        const [tableExists] = await schemaCheckConn.query(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chat_sessions'
        `, [dbName]);
        if (tableExists.length > 0) {
          console.log('[Database] Old schema detected (missing chat_id column). Dropping tables for recreation...');
          await schemaCheckConn.query('DROP TABLE IF EXISTS messages');
          await schemaCheckConn.query('DROP TABLE IF EXISTS chat_sessions');
        }
      }
    } catch (err) {
      console.warn('[Database] Schema check failed, proceeding with standard creation:', err.message);
    } finally {
      if (schemaCheckConn) schemaCheckConn.release();
    }

    // 3. Create tables
    await createTables();

  } catch (error) {
    console.error('[Database] Connection or table creation failed:', error.message);
    throw error;
  }
}

async function createTables() {
  const createVendorsTable = `
    CREATE TABLE IF NOT EXISTS vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const createChatSessionsTable = `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chat_id VARCHAR(50) NOT NULL UNIQUE,
      vendor_id INT NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) DEFAULT NULL,
      customer_email VARCHAR(255) DEFAULT NULL,
      avatar VARCHAR(10) DEFAULT NULL,
      status VARCHAR(20) DEFAULT 'offline',
      last_message TEXT DEFAULT NULL,
      unread_count INT DEFAULT 0,
      last_active VARCHAR(50) DEFAULT NULL,
      device_interest VARCHAR(255) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      is_group TINYINT(1) DEFAULT 0,
      group_name VARCHAR(255) DEFAULT NULL,
      group_members TEXT DEFAULT NULL,
      recipient_vendor_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  const createMessagesTable = `
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chat_id VARCHAR(50) NOT NULL,
      sender VARCHAR(20) NOT NULL,
      sender_id INT DEFAULT NULL,
      sender_name VARCHAR(255) DEFAULT NULL,
      text TEXT DEFAULT NULL,
      timestamp VARCHAR(50) DEFAULT NULL,
      status VARCHAR(20) DEFAULT 'sent',
      attachment_type VARCHAR(20) DEFAULT NULL,
      attachment_name VARCHAR(255) DEFAULT NULL,
      attachment_size VARCHAR(50) DEFAULT NULL,
      attachment_url LONGTEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chat_sessions(chat_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(createVendorsTable);
    console.log('[Database] Vendors table verified/created successfully.');

    await connection.query(createChatSessionsTable);
    console.log('[Database] Chat sessions table verified/created successfully.');

    await connection.query(createMessagesTable);
    console.log('[Database] Messages table verified/created successfully.');

    // Gracefully alter table to add columns for profile details if they don't exist
    const alterQueries = [
      "ALTER TABLE vendors ADD COLUMN phone VARCHAR(50) DEFAULT NULL;",
      "ALTER TABLE vendors ADD COLUMN shop_name VARCHAR(255) DEFAULT NULL;",
      "ALTER TABLE vendors ADD COLUMN address TEXT DEFAULT NULL;",
      "ALTER TABLE vendors ADD COLUMN payment_methods TEXT DEFAULT NULL;",
      "ALTER TABLE vendors ADD COLUMN profile_img LONGTEXT DEFAULT NULL;",
      "ALTER TABLE chat_sessions ADD COLUMN recipient_vendor_id INT DEFAULT NULL;",
      "ALTER TABLE chat_sessions ADD COLUMN is_group TINYINT(1) DEFAULT 0;",
      "ALTER TABLE chat_sessions ADD COLUMN group_name VARCHAR(255) DEFAULT NULL;",
      "ALTER TABLE chat_sessions ADD COLUMN group_members TEXT DEFAULT NULL;",
      "ALTER TABLE messages ADD COLUMN sender_id INT DEFAULT NULL;",
      "ALTER TABLE messages ADD COLUMN sender_name VARCHAR(255) DEFAULT NULL;"
    ];

    for (const query of alterQueries) {
      try {
        await connection.query(query);
      } catch (err) {
        // Catch and ignore ER_DUP_FIELDNAME (Duplicate column name)
        if (err.errno !== 1060 && err.sqlState !== '42S21') {
          throw err;
        }
      }
    }
    console.log('[Database] Vendor profile columns verified/updated successfully.');

    // Reset B2B sessions to offline on boot
    await connection.query("UPDATE chat_sessions SET status = 'offline' WHERE recipient_vendor_id IS NOT NULL;");
    console.log('[Database] Reset all B2B session statuses to offline on boot.');

  } catch (error) {
    console.error('[Database] Failed to create or update tables:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  initializeDatabase,
  query: (sql, params) => pool.execute(sql, params),
  getPool: () => pool
};
