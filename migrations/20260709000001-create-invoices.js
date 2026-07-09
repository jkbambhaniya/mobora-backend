'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("invoices", {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false,
			},
			invoice_number: {
				type: Sequelize.STRING(100),
				allowNull: false,
				unique: true,
			},
			transaction_id: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: "transactions",
					key: "id",
				},
				onDelete: "SET NULL",
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
			partner_id: {
				type: Sequelize.INTEGER,
				allowNull: true,
			},
			partner_type: {
				type: Sequelize.ENUM("Customer", "Vendor"),
				allowNull: true,
			},
			type: {
				type: Sequelize.ENUM("Sale", "Purchase", "Exchange", "PlanPurchase"),
				allowNull: false,
			},
			amount: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			tax_amount: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
			status: {
				type: Sequelize.ENUM("Paid", "Pending", "Cancelled"),
				allowNull: false,
				defaultValue: "Paid",
			},
			notes: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			date: {
				type: Sequelize.STRING(50),
				allowNull: false,
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

		await queryInterface.addIndex("invoices", ["invoice_number"]);
		await queryInterface.addIndex("invoices", ["transaction_id"]);
		await queryInterface.addIndex("invoices", ["vendor_id"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("invoices");
	},
};
