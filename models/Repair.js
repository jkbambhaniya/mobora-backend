const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Repair = sequelize.define(
		"Repair",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			vendor_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "vendor_id",
			},
			customer_name: {
				type: DataTypes.STRING,
				allowNull: false,
				field: "customer_name",
			},
			customer_phone: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: "customer_phone",
			},
			device_model: {
				type: DataTypes.STRING,
				allowNull: false,
				field: "device_model",
			},
			imei: {
				type: DataTypes.STRING(15),
				allowNull: true,
			},
			issues: {
				type: DataTypes.TEXT,
				allowNull: false,
				defaultValue: "[]",
			},
			estimated_cost: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: "estimated_cost",
			},
			status: {
				type: DataTypes.ENUM("Received", "Diagnosing", "Repaired", "Delivered", "Cancelled"),
				allowNull: false,
				defaultValue: "Received",
			},
			delivery_date: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: "delivery_date",
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
		},
		{
			tableName: "repairs",
			underscored: true,
			timestamps: true,
		},
	);

	return Repair;
};
