'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// 1. Temporarily expand ENUM to allow both old and new values
		await queryInterface.sequelize.query("ALTER TABLE brands MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE models MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE rams MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE storages MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");

		// 2. Update existing values
		await queryInterface.sequelize.query("UPDATE brands SET status = 'active' WHERE status = 'approved' OR status = ''");
		await queryInterface.sequelize.query("UPDATE brands SET status = 'inactive' WHERE status = 'rejected'");

		await queryInterface.sequelize.query("UPDATE models SET status = 'active' WHERE status = 'approved' OR status = ''");
		await queryInterface.sequelize.query("UPDATE models SET status = 'inactive' WHERE status = 'rejected'");

		await queryInterface.sequelize.query("UPDATE rams SET status = 'active' WHERE status = 'approved' OR status = ''");
		await queryInterface.sequelize.query("UPDATE rams SET status = 'inactive' WHERE status = 'rejected'");

		await queryInterface.sequelize.query("UPDATE storages SET status = 'active' WHERE status = 'approved' OR status = ''");
		await queryInterface.sequelize.query("UPDATE storages SET status = 'inactive' WHERE status = 'rejected'");

		// 3. Alter columns to final ENUM state
		await queryInterface.sequelize.query("ALTER TABLE brands MODIFY COLUMN status ENUM('pending', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE models MODIFY COLUMN status ENUM('pending', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE rams MODIFY COLUMN status ENUM('pending', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE storages MODIFY COLUMN status ENUM('pending', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
	},

	down: async (queryInterface, Sequelize) => {
		// 1. Temporarily expand ENUM to allow both states
		await queryInterface.sequelize.query("ALTER TABLE brands MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE models MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE rams MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE storages MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive') NOT NULL DEFAULT 'pending'");

		// 2. Revert values
		await queryInterface.sequelize.query("UPDATE brands SET status = 'approved' WHERE status = 'active'");
		await queryInterface.sequelize.query("UPDATE brands SET status = 'rejected' WHERE status = 'inactive'");

		await queryInterface.sequelize.query("UPDATE models SET status = 'approved' WHERE status = 'active'");
		await queryInterface.sequelize.query("UPDATE models SET status = 'rejected' WHERE status = 'inactive'");

		await queryInterface.sequelize.query("UPDATE rams SET status = 'approved' WHERE status = 'active'");
		await queryInterface.sequelize.query("UPDATE rams SET status = 'rejected' WHERE status = 'inactive'");

		await queryInterface.sequelize.query("UPDATE storages SET status = 'approved' WHERE status = 'active'");
		await queryInterface.sequelize.query("UPDATE storages SET status = 'rejected' WHERE status = 'inactive'");

		// 3. Revert columns to original state
		await queryInterface.sequelize.query("ALTER TABLE brands MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE models MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE rams MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
		await queryInterface.sequelize.query("ALTER TABLE storages MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
	}
};
