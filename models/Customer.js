const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Customer = sequelize.define('Customer', {
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
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		phone: {
			type: DataTypes.STRING(50),
			allowNull: false,
		},
		status: {
			type: DataTypes.STRING(50),
			defaultValue: 'Active',
		},
		address: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		notes: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		profile_img: {
			type: DataTypes.TEXT('long'),
			allowNull: true,
			field: 'profile_img',
			get() {
				const img = this.getDataValue('profile_img');
				if (!img) {
					const name = this.getDataValue('name') || 'Customer';
					return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
				}
				if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) return img;
				const host = process.env.APP_URL || "http://127.0.0.1:5000";
				return `${host}${img}`;
			}
		},
		profile_image_url: {
			type: DataTypes.VIRTUAL,
			get() {
				return this.profile_img;
			}
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
		tableName: 'customers',
		underscored: true,
		timestamps: true,
	});

	return Customer;
};
