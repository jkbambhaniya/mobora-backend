'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const brands = [
			{ id: 1, name: 'Apple', slug: 'apple', status: 'approved', created_at: new Date() },
			{ id: 2, name: 'Samsung', slug: 'samsung', status: 'approved', created_at: new Date() },
			{ id: 3, name: 'OnePlus', slug: 'oneplus', status: 'approved', created_at: new Date() },
			{ id: 4, name: 'Google', slug: 'google', status: 'approved', created_at: new Date() }
		];
		await queryInterface.bulkInsert('brands', brands, {});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('brands', null, {});
	}
};
