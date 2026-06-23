const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const BusinessDetail = sequelize.define('BusinessDetail', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		vendor_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: 'vendors',
				key: 'id',
			},
			onDelete: 'CASCADE',
			field: 'vendor_id',
		},
		shop_name: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'shop_name',
		},
		phone: {
			type: DataTypes.STRING(50),
			allowNull: true,
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
		gst_enabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
			field: 'gst_enabled',
		},
		gst_rate: {
			type: DataTypes.INTEGER,
			defaultValue: 18,
			field: 'gst_rate',
		},
	}, {
		tableName: 'business_details',
		underscored: true,
		timestamps: true,
	});

	return BusinessDetail;
};
