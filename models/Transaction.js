const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Transaction = sequelize.define(
		"Transaction",
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
			customer_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "customer_id",
			},
			mobile_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "mobile_id",
			},
			type: {
				type: DataTypes.ENUM("Sale", "Purchase", "Exchange"),
				allowNull: false,
			},
			amount: {
				type: DataTypes.INTEGER,
				allowNull: false,
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
			tableName: "transactions",
			underscored: true,
			timestamps: true,
		},
	);

	return Transaction;
};
