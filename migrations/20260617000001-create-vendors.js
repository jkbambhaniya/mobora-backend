'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('vendors', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false
			},
			email: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true
			},
			password: {
				type: Sequelize.STRING,
				allowNull: false
			},
			status: {
				type: Sequelize.STRING(50),
				defaultValue: 'pending'
			},
			phone: {
				type: Sequelize.STRING(50),
				allowNull: true
			},
			shop_name: {
				type: Sequelize.STRING,
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
			profile_img: {
				type: Sequelize.TEXT('long'),
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
		await queryInterface.dropTable('vendors');
	}
};
