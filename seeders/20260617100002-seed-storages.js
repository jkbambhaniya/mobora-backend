'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const storages = [
			{ id: 1, value: '64 GB', status: 'active', created_at: new Date() },
			{ id: 2, value: '128 GB', status: 'active', created_at: new Date() },
			{ id: 3, value: '256 GB', status: 'active', created_at: new Date() },
			{ id: 4, value: '512 GB', status: 'active', created_at: new Date() },
			{ id: 5, value: '1 TB', status: 'active', created_at: new Date() }
		];
		await queryInterface.bulkInsert('storages', storages, {});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('storages', null, {});
	}
};
