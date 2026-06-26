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
			type: DataTypes.ENUM('pending', 'active', 'inactive'),
			defaultValue: 'pending',
		},
		profile_img: {
			type: DataTypes.TEXT('long'),
			allowNull: true,
			field: 'profile_img',
			get() {
				const img = this.getDataValue('profile_img');
				if (!img) {
					const name = this.getDataValue('name') || 'Vendor';
					return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
				}
				if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) return img;
				const host = process.env.APP_URL || "";
				return `${host}${img}`;
			}
		},
		profile_image_url: {
			type: DataTypes.VIRTUAL,
			get() {
				return this.profile_img;
			}
		},
	}, {
		tableName: 'vendors',
		underscored: true,
		timestamps: true,
	});

	return Vendor;
};
