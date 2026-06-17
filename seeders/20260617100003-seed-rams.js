'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const rams = [
			{ id: 1, value: '4 GB', status: 'approved', created_at: new Date() },
			{ id: 2, value: '6 GB', status: 'approved', created_at: new Date() },
			{ id: 3, value: '8 GB', status: 'approved', created_at: new Date() },
			{ id: 4, value: '12 GB', status: 'approved', created_at: new Date() },
			{ id: 5, value: '16 GB', status: 'approved', created_at: new Date() }
		];
		await queryInterface.bulkInsert('rams', rams, {});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('rams', null, {});
	}
};
