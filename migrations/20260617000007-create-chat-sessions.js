'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('chat_sessions', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			chat_id: {
				type: Sequelize.STRING(50),
				allowNull: false,
				unique: true
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
			customer_name: {
				type: Sequelize.STRING,
				allowNull: false
			},
			customer_phone: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			customer_email: {
				type: Sequelize.STRING,
				allowNull: true
			},
			avatar: {
				type: Sequelize.STRING(10),
				allowNull: true
			},
			status: {
				type: Sequelize.STRING(20),
				defaultValue: 'offline'
			},
			last_message: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			unread_count: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			last_active: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			device_interest: {
				type: Sequelize.STRING,
				allowNull: true
			},
			notes: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			is_group: {
				type: Sequelize.BOOLEAN,
				defaultValue: false
			},
			group_name: {
				type: Sequelize.STRING,
				allowNull: true
			},
			group_members: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			recipient_vendor_id: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'vendors',
					key: 'id'
				},
				onDelete: 'SET NULL'
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
			}
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('chat_sessions');
	}
};
