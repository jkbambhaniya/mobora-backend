const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Message = sequelize.define('Message', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		chat_id: {
			type: DataTypes.STRING(50),
			allowNull: false,
			field: 'chat_id',
		},
		sender: {
			type: DataTypes.STRING(20),
			allowNull: false,
		},
		sender_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			field: 'sender_id',
		},
		sender_name: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'sender_name',
		},
		text: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		timestamp: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		status: {
			type: DataTypes.STRING(20),
			defaultValue: 'sent',
		},
		attachment_type: {
			type: DataTypes.STRING(20),
			allowNull: true,
			field: 'attachment_type',
		},
		attachment_name: {
			type: DataTypes.STRING,
			allowNull: true,
			field: 'attachment_name',
		},
		attachment_size: {
			type: DataTypes.STRING(50),
			allowNull: true,
			field: 'attachment_size',
		},
		attachment_url: {
			type: DataTypes.TEXT('long'),
			allowNull: true,
			field: 'attachment_url',
		},
	}, {
		tableName: 'messages',
		underscored: true,
		timestamps: true,
		updatedAt: false,
	});

	return Message;
};
