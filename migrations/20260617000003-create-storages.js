'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('storages', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false
			},
			value: {
				type: Sequelize.STRING(100),
				allowNull: false,
				unique: true
			},
			status: {
				type: Sequelize.ENUM('pending', 'approved', 'rejected'),
				defaultValue: 'pending'
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			}
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('storages');
	}
};
