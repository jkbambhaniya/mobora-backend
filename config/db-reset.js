const { sequelize } = require("./db");

async function reset() {
	try {
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");
		const [tables] = await sequelize.query("SHOW TABLES;");
		const dbName = sequelize.config.database;
		const keyName = `Tables_in_${dbName}`;

		for (const row of tables) {
			const tableName = row[keyName];
			await sequelize.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
		}
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
		console.log("[Database] All tables dropped successfully.");
		process.exit(0);
	} catch (err) {
		console.error("[Database] Reset failed:", err.message);
		process.exit(1);
	}
}

reset();
