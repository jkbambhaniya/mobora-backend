const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Invoice = sequelize.define(
		"Invoice",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			invoice_number: {
				type: DataTypes.STRING(100),
				allowNull: false,
				unique: true,
				field: "invoice_number",
			},
			transaction_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "transaction_id",
			},
			vendor_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "vendor_id",
			},
			partner_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "partner_id",
			},
			partner_type: {
				type: DataTypes.ENUM("Customer", "Vendor"),
				allowNull: true,
				field: "partner_type",
			},
			type: {
				type: DataTypes.ENUM("Sale", "Purchase", "Exchange", "PlanPurchase"),
				allowNull: false,
			},
			amount: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			tax_amount: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: "tax_amount",
			},
			status: {
				type: DataTypes.ENUM("Paid", "Pending", "Cancelled"),
				allowNull: false,
				defaultValue: "Paid",
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			date: {
				type: DataTypes.STRING(50),
				allowNull: false,
			},
		},
		{
			tableName: "invoices",
			underscored: true,
			timestamps: true,
		},
	);

	return Invoice;
};
