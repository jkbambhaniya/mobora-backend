'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('customers', {
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
			name: {
				type: Sequelize.STRING,
				allowNull: false
			},
			email: {
				type: Sequelize.STRING,
				allowNull: true
			},
			phone: {
				type: Sequelize.STRING(50),
				allowNull: false
			},
			status: {
				type: Sequelize.STRING(50),
				defaultValue: 'Active'
			},
			address: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			notes: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			profile_img: {
				type: Sequelize.TEXT('long'),
				allowNull: true
			},
			total_orders: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			total_spent: {
				type: Sequelize.INTEGER,
				defaultValue: 0
			},
			joined_date: {
				type: Sequelize.STRING(50),
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
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('customers');
	}
};
