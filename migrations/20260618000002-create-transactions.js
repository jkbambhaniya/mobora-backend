'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("transactions", {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false,
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
			customer_id: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: "customers",
					key: "id",
				},
				onDelete: "SET NULL",
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
			type: {
				type: Sequelize.ENUM("Sale", "Purchase", "Exchange"),
				allowNull: false,
			},
			amount: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			date: {
				type: Sequelize.STRING(50),
				allowNull: false,
			},
			notes: {
				type: Sequelize.TEXT,
				allowNull: true,
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

		await queryInterface.addIndex("transactions", ["vendor_id"]);
		await queryInterface.addIndex("transactions", ["customer_id"]);
		await queryInterface.addIndex("transactions", ["mobile_id"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("transactions");
	},
};
