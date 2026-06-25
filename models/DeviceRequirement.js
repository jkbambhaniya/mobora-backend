const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const DeviceRequirement = sequelize.define(
		"DeviceRequirement",
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
				allowNull: true,
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: "Active",
			},
		},
		{
			tableName: "device_requirements",
			underscored: true,
			timestamps: true,
		},
	);

	return DeviceRequirement;
};
