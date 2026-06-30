'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('customer_kyc_documents', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			customer_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'customers',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			document_path: {
				type: Sequelize.STRING(255),
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

		await queryInterface.addIndex('customer_kyc_documents', ['customer_id']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('customer_kyc_documents');
	}
};
