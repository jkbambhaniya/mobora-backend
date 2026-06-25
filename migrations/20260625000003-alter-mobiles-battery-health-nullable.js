'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('mobiles', 'battery_health', {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: null,
		});
	},

	down: async (queryInterface, Sequelize) => {
		// Revert: set back to NOT NULL (requires existing NULLs to be handled)
		await queryInterface.changeColumn('mobiles', 'battery_health', {
			type: Sequelize.INTEGER,
			allowNull: false,
		});
	},
};
