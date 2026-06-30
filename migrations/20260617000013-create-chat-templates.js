'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('chat_templates', {
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
			template_text: {
				type: Sequelize.TEXT,
				allowNull: false
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

		await queryInterface.addIndex('chat_templates', ['vendor_id']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('chat_templates');
	}
};
