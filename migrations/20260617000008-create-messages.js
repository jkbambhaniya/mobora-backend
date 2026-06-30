'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('messages', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			chat_id: {
				type: Sequelize.STRING(50),
				allowNull: false,
				references: {
					model: 'chat_sessions',
					key: 'chat_id'
				},
				onDelete: 'CASCADE'
			},
			sender: {
				type: Sequelize.STRING(20),
				allowNull: false
			},
			sender_id: {
				type: Sequelize.INTEGER,
				allowNull: true
			},
			sender_name: {
				type: Sequelize.STRING,
				allowNull: true
			},
			text: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			timestamp: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			status: {
				type: Sequelize.ENUM('sent', 'delivered', 'read'),
				defaultValue: 'sent'
			},
			attachment_type: {
				type: Sequelize.STRING(20),
				allowNull: true
			},
			attachment_name: {
				type: Sequelize.STRING,
				allowNull: true
			},
			attachment_size: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			attachment_url: {
				type: Sequelize.TEXT('long'),
				allowNull: true
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			}
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('messages');
	}
};
