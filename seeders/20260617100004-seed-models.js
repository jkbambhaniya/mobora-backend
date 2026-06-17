'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const models = [
			{ id: 1, brand_id: 1, name: 'iPhone 13 Pro', slug: 'iphone-13-pro', vendor_id: null, created_at: new Date() },
			{ id: 2, brand_id: 1, name: 'iPhone 14', slug: 'iphone-14', vendor_id: null, created_at: new Date() },
			{ id: 3, brand_id: 2, name: 'Galaxy S22 Ultra', slug: 'galaxy-s22-ultra', vendor_id: null, created_at: new Date() },
			{ id: 4, brand_id: 3, name: 'OnePlus 10 Pro', slug: 'oneplus-10-pro', vendor_id: null, created_at: new Date() },
			{ id: 5, brand_id: 4, name: 'Pixel 7 Pro', slug: 'pixel-7-pro', vendor_id: null, created_at: new Date() }
		];
		await queryInterface.bulkInsert('models', models, {});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('models', null, {});
	}
};
