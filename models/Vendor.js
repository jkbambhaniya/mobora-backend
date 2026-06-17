const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Vendor = sequelize.define('Vendor', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		status: {
			type: DataTypes.STRING(50),
			defaultValue: 'pending',
		},
		phone: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		shop_name: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'shop_name',
		},
		address: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		payment_methods: {
			type: DataTypes.TEXT,
			allowNull: true,
			field: 'payment_methods',
		},
		profile_img: {
			type: DataTypes.TEXT('long'),
			allowNull: true,
			field: 'profile_img',
		},
	}, {
		tableName: 'vendors',
		underscored: true,
		timestamps: true,
	});

	return Vendor;
};
