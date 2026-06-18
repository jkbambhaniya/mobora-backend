const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Mobile = sequelize.define(
		"Mobile",
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
			brand_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "brand_id",
			},
			model_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "model_id",
			},
			storage_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "storage_id",
			},
			ram_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "ram_id",
			},
			color: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			imei: {
				type: DataTypes.STRING(15),
				allowNull: true,
				unique: true,
			},
			condition: {
				type: DataTypes.ENUM("Mint", "Excellent", "Good", "Fair"),
				allowNull: false,
			},

			battery_health: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "battery_health",
			},
			status: {
				type: DataTypes.ENUM("Active", "Sold", "Review"),
				allowNull: false,
				defaultValue: "Active",
			},
			description: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
		},
		{
			tableName: "mobiles",
			underscored: true,
			timestamps: true,
		},
	);

	return Mobile;
};
