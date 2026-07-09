'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add order_by column to rams
		await queryInterface.addColumn('rams', 'order_by', {
			type: Sequelize.INTEGER,
			allowNull: true,
		});

		// Add order_by column to storages
		await queryInterface.addColumn('storages', 'order_by', {
			type: Sequelize.INTEGER,
			allowNull: true,
		});

		// Backfill existing records
		await queryInterface.sequelize.query("UPDATE rams SET order_by = id");
		await queryInterface.sequelize.query("UPDATE storages SET order_by = id");
	},

	down: async (queryInterface, Sequelize) => {
		// Remove columns
		await queryInterface.removeColumn('rams', 'order_by');
		await queryInterface.removeColumn('storages', 'order_by');
	}
};
