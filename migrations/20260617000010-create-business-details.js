'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('business_details', {
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
			shop_name: {
				type: Sequelize.STRING,
				allowNull: true
			},
			phone: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			address: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			payment_methods: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			gst_enabled: {
				type: Sequelize.BOOLEAN,
				defaultValue: true
			},
			gst_rate: {
				type: Sequelize.INTEGER,
				defaultValue: 18
			},
			markup: {
				type: Sequelize.INTEGER,
				defaultValue: 20
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

		await queryInterface.addIndex('business_details', ['vendor_id']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('business_details');
	}
};
