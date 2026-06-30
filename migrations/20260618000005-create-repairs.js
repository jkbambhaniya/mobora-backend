'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('repairs', {
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
			customer_name: {
				type: Sequelize.STRING,
				allowNull: false
			},
			customer_phone: {
				type: Sequelize.STRING(50),
				allowNull: false
			},
			device_model: {
				type: Sequelize.STRING,
				allowNull: false
			},
			imei: {
				type: Sequelize.STRING(15),
				allowNull: true
			},
			issues: {
				type: Sequelize.TEXT,
				allowNull: false,
				defaultValue: "[]"
			},
			estimated_cost: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0
			},
			status: {
				type: Sequelize.ENUM("Received", "Diagnosing", "Repaired", "Delivered", "Cancelled"),
				allowNull: false,
				defaultValue: "Received"
			},
			delivery_date: {
				type: Sequelize.STRING(50),
				allowNull: false
			},
			notes: {
				type: Sequelize.TEXT,
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

		await queryInterface.addIndex('repairs', ['vendor_id']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('repairs');
	}
};
