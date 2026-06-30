'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('customer_kycs', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			customer_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				unique: true,
				references: {
					model: 'customers',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			id_type: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			id_number: {
				type: Sequelize.STRING(100),
				allowNull: true
			},
			kyc_status: {
				type: Sequelize.ENUM("Pending", "Verified", "Rejected"),
				defaultValue: "Verified"
			},
			kyc_document_img: {
				type: Sequelize.TEXT("long"),
				allowNull: true
			},
			verified_at: {
				type: Sequelize.DATE,
				allowNull: true
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

		await queryInterface.addIndex('customer_kycs', ['customer_id']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('customer_kycs');
	}
};
