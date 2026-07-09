'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// 1. Change mobile_id to be nullable
		await queryInterface.changeColumn('transactions', 'mobile_id', {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: 'mobiles',
				key: 'id'
			},
			onDelete: 'CASCADE'
		});

		// 2. Change type column to include 'PlanPurchase'
		await queryInterface.changeColumn('transactions', 'type', {
			type: Sequelize.ENUM('Sale', 'Purchase', 'Exchange', 'PlanPurchase'),
			allowNull: false
		});
	},

	down: async (queryInterface, Sequelize) => {
		// Revert type column back to original enum
		await queryInterface.changeColumn('transactions', 'type', {
			type: Sequelize.ENUM('Sale', 'Purchase', 'Exchange'),
			allowNull: false
		});

		// Revert mobile_id to NOT NULL
		await queryInterface.changeColumn('transactions', 'mobile_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
			references: {
				model: 'mobiles',
				key: 'id'
			},
			onDelete: 'CASCADE'
		});
	}
};
