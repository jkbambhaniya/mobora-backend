'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('models', 'status', {
			type: Sequelize.ENUM('pending', 'approved', 'rejected'),
			defaultValue: 'pending',
			allowNull: false
		});

		// Approve existing models so they remain visible
		await queryInterface.sequelize.query("UPDATE models SET status = 'approved'");
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('models', 'status');
	}
};
