const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const MobileStock = sequelize.define(
		"MobileStock",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			mobile_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "mobile_id",
			},
			vendor_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "vendor_id",
			},
			status: {
				type: DataTypes.ENUM("Available", "Sold", "Review", "Transit", "Pending", "Shipped", "Cancelled"),
				allowNull: false,
				defaultValue: "Available",
			},
			repairing_cost: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: "repairing_cost",
			},
		},
		{
			tableName: "mobile_stocks",
			underscored: true,
			timestamps: true,
		},
	);

	return MobileStock;
};
