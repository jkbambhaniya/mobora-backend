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
		require('../models');
		await sequelize.sync({ alter: true });
		console.log("[Database] Database tables synced successfully.");

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
