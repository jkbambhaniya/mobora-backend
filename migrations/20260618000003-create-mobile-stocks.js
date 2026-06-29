'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("mobile_stocks", {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false,
			},
			mobile_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "mobiles",
					key: "id",
				},
				onDelete: "CASCADE",
			},
			vendor_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "vendors",
					key: "id",
				},
				onDelete: "CASCADE",
			},
			status: {
				type: Sequelize.ENUM("Available", "Sold", "Review", "Transit", "Pending", "Shipped", "Cancelled"),
				allowNull: false,
				defaultValue: "Available",
			},
			repairing_cost: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
			},
		});

		await queryInterface.addIndex("mobile_stocks", ["mobile_id"]);
		await queryInterface.addIndex("mobile_stocks", ["vendor_id"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("mobile_stocks");
	}
};
