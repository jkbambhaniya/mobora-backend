'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('courier_orders', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			seller_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'vendors',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			buyer_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'vendors',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			seller_mobile_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'mobiles',
					key: 'id'
				},
				onDelete: 'CASCADE'
			},
			buyer_mobile_id: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'mobiles',
					key: 'id'
				},
				onDelete: 'SET NULL'
			},
			amount: {
				type: Sequelize.INTEGER,
				allowNull: false
			},
			courier_name: {
				type: Sequelize.STRING,
				allowNull: true
			},
			tracking_id: {
				type: Sequelize.STRING,
				allowNull: true
			},
			status: {
				type: Sequelize.ENUM("Pending", "Shipped", "Delivered", "Cancelled"),
				allowNull: false,
				defaultValue: "Pending"
			},
			date: {
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

		await queryInterface.addIndex('courier_orders', ['seller_id']);
		await queryInterface.addIndex('courier_orders', ['buyer_id']);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('courier_orders');
	}
};
