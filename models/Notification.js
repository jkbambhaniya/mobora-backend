const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Notification = sequelize.define('Notification', {
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
		type: {
			type: DataTypes.STRING(50),
			defaultValue: 'info',
		},
		title: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		body: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		chat_id: {
			type: DataTypes.STRING(50),
			allowNull: true,
			field: 'chat_id',
		},
		sender_name: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'sender_name',
		},
		is_read: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			field: 'is_read',
		},
		timestamp: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
	}, {
		tableName: 'notifications',
		underscored: true,
		timestamps: true,
		updatedAt: false,
	});

	return Notification;
};
