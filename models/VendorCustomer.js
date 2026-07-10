const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const VendorCustomer = sequelize.define('VendorCustomer', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		vendor_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: 'vendor_id',
		},
		customer_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: 'customer_id',
		},
		total_orders: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			field: 'total_orders',
		},
		total_spent: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			field: 'total_spent',
		},
		joined_date: {
			type: DataTypes.STRING(50),
			allowNull: true,
			field: 'joined_date',
		},
	}, {
		tableName: 'vendor_customers',
		underscored: true,
		timestamps: true,
	});

	return VendorCustomer;
};
