const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const ChatTemplate = sequelize.define('ChatTemplate', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		vendor_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		template_text: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
	}, {
		tableName: 'chat_templates',
		underscored: true,
		timestamps: true,
	});

	return ChatTemplate;
};
