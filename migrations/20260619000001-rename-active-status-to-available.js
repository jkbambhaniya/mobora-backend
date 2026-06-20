'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// 1. Alter ENUM to include 'Available'
		await queryInterface.sequelize.query(
			"ALTER TABLE mobiles MODIFY COLUMN status ENUM('Active', 'Available', 'Sold', 'Review') NOT NULL DEFAULT 'Active';"
		);

		// 2. Update existing 'Active' records to 'Available'
		await queryInterface.sequelize.query(
			"UPDATE mobiles SET status = 'Available' WHERE status = 'Active';"
		);

		// 3. Alter ENUM to remove 'Active' and make 'Available' the default
		await queryInterface.sequelize.query(
			"ALTER TABLE mobiles MODIFY COLUMN status ENUM('Available', 'Sold', 'Review') NOT NULL DEFAULT 'Available';"
		);
	},

	down: async (queryInterface, Sequelize) => {
		// 1. Alter ENUM to include 'Active'
		await queryInterface.sequelize.query(
			"ALTER TABLE mobiles MODIFY COLUMN status ENUM('Active', 'Available', 'Sold', 'Review') NOT NULL DEFAULT 'Available';"
		);

		// 2. Update existing 'Available' records to 'Active'
		await queryInterface.sequelize.query(
			"UPDATE mobiles SET status = 'Active' WHERE status = 'Available';"
		);

		// 3. Alter ENUM to remove 'Available' and make 'Active' the default
		await queryInterface.sequelize.query(
			"ALTER TABLE mobiles MODIFY COLUMN status ENUM('Active', 'Sold', 'Review') NOT NULL DEFAULT 'Active';"
		);
	}
};
