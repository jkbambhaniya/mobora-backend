const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const ChatSession = sequelize.define('ChatSession', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		chat_id: {
			type: DataTypes.STRING(50),
			allowNull: false,
			unique: true,
			field: 'chat_id',
		},
		vendor_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: 'vendor_id',
		},
		customer_name: {
			type: DataTypes.STRING,
			allowNull: false,
			field: 'customer_name',
		},
		customer_phone: {
			type: DataTypes.STRING(50),
			allowNull: true,
			field: 'customer_phone',
		},
		customer_email: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'customer_email',
		},
		avatar: {
			type: DataTypes.STRING(10),
			allowNull: true,
		},
		status: {
			type: DataTypes.STRING(20),
			defaultValue: 'offline',
		},
		last_message: {
			type: DataTypes.TEXT,
			allowNull: true,
			field: 'last_message',
		},
		unread_count: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			field: 'unread_count',
		},
		admin_unread_count: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			field: 'admin_unread_count',
		},
		last_active: {
			type: DataTypes.STRING(50),
			allowNull: true,
			field: 'last_active',
		},
		device_interest: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'device_interest',
		},
		notes: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		is_group: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			field: 'is_group',
		},
		group_name: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'group_name',
		},
		group_members: {
			type: DataTypes.TEXT,
			allowNull: true,
			field: 'group_members',
		},
		recipient_vendor_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			field: 'recipient_vendor_id',
		},
	}, {
		tableName: 'chat_sessions',
		underscored: true,
		timestamps: true,
	});

	return ChatSession;
};
