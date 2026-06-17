'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('notifications', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			vendor_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'vendors',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			type: {
				type: Sequelize.STRING(50),
				defaultValue: 'info',
				allowNull: false
			},
			title: {
				type: Sequelize.STRING,
				allowNull: false
			},
			body: {
				type: Sequelize.TEXT,
				allowNull: false
			},
			chat_id: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			sender_name: {
				type: Sequelize.STRING,
				allowNull: true
			},
			is_read: {
				type: Sequelize.BOOLEAN,
				defaultValue: false,
				allowNull: false
			},
			timestamp: {
				type: Sequelize.STRING(50),
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
		await queryInterface.dropTable('notifications');
	}
};
