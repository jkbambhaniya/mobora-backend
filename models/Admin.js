const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Admin = sequelize.define('Admin', {
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
		profile_img: {
			type: DataTypes.TEXT('long'),
			allowNull: true,
		},
	}, {
		tableName: 'admins',
		underscored: true,
		timestamps: true,
	});

	return Admin;
};
