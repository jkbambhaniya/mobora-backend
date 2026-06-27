const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
	host: process.env.DB_HOST || "127.0.0.1",
	port: process.env.DB_PORT || 3306,
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
};

const dbName = process.env.DB_NAME || "mobora";

const sequelize = new Sequelize(dbName, dbConfig.user, dbConfig.password, {
	host: dbConfig.host,
	port: dbConfig.port,
	dialect: 'mysql',
	logging: false,
	define: {
		timestamps: true,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		underscored: true,
	}
});

async function initializeDatabase() {
	try {
		// 1. Create database if it doesn't exist
		const connection = await mysql.createConnection(dbConfig);
		await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
		await connection.end();

		// 2. Authenticate Sequelize
		await sequelize.authenticate();
		console.log(`[Database] Connected to MySQL database via Sequelize: "${dbName}"`);

		// 3. Sync models (import models/index.js to register them first)
		const models = require('../models');
		await sequelize.sync();
		console.log("[Database] Database tables synced successfully.");

		try {
			await sequelize.query(
				"ALTER TABLE chat_sessions ADD COLUMN admin_unread_count INT DEFAULT 0;"
			);
			console.log("[Database] Added admin_unread_count column to chat_sessions.");
		} catch (e) {
			// Ignore if column already exists
		}

		try {
			await sequelize.query(
				"ALTER TABLE business_details ADD COLUMN markup INT DEFAULT 20;"
			);
			console.log("[Database] Added markup column to business_details.");
		} catch (e) {
			// Ignore if column already exists
		}

		try {
			await sequelize.query(
				"ALTER TABLE mobiles ADD COLUMN repairing_cost INT NOT NULL DEFAULT 0;"
			);
			console.log("[Database] Added repairing_cost column to mobiles.");
		} catch (e) {
			// Ignore if column already exists
		}

		try {
			await sequelize.query(
				"ALTER TABLE mobiles MODIFY COLUMN status ENUM('Available', 'Sold', 'Review', 'Transit', 'Pending', 'Shipped', 'Cancelled') NOT NULL DEFAULT 'Available';"
			);
			console.log("[Database] Modified mobiles status enum to include all transit statuses.");
		} catch (e) {
			console.error("[Database] Error modifying status enum:", e.message);
		}

		try {
			await sequelize.query(
				"ALTER TABLE mobiles DROP INDEX imei;"
			);
			console.log("[Database] Dropped unique index imei on mobiles.");
		} catch (e) {
			// Ignore if index does not exist or has already been dropped
		}

		// Seed default admin
		const adminCount = await models.Admin.count();
		if (adminCount === 0) {
			const bcrypt = require('bcryptjs');
			const hashedPassword = await bcrypt.hash('Admin@12345', 12);
			await models.Admin.create({
				name: 'System Admin',
				email: 'admin@mobora.com',
				password: hashedPassword
			});
			console.log("[Database] Default admin seeded successfully: admin@mobora.com / Admin@12345");
		}

		// 4. Post-boot: Reset B2B sessions to offline on boot
		await sequelize.query(
			"UPDATE chat_sessions SET status = 'offline' WHERE recipient_vendor_id IS NOT NULL;"
		);
		console.log("[Database] Reset all B2B session statuses to offline on boot.");
	} catch (error) {
		console.error("[Database] Initialization failed:", error.message);
		throw error;
	}
}

module.exports = {
	sequelize,
	initializeDatabase,
	query: (sql, params) => sequelize.query(sql, { replacements: params })
};
