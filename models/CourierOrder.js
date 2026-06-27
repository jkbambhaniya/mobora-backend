const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const CourierOrder = sequelize.define(
		"CourierOrder",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			seller_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "seller_id",
			},
			buyer_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "buyer_id",
			},
			seller_mobile_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "seller_mobile_id",
			},
			buyer_mobile_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "buyer_mobile_id",
			},
			amount: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			courier_name: {
				type: DataTypes.STRING,
				allowNull: true,
				field: "courier_name",
			},
			tracking_id: {
				type: DataTypes.STRING,
				allowNull: true,
				field: "tracking_id",
			},
			status: {
				type: DataTypes.ENUM("Pending", "Shipped", "Delivered", "Cancelled"),
				allowNull: false,
				defaultValue: "Pending",
			},
			date: {
				type: DataTypes.STRING(50),
				allowNull: false,
			},
			notes: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
		},
		{
			tableName: "courier_orders",
			underscored: true,
			timestamps: true,
		},
	);

	return CourierOrder;
};
