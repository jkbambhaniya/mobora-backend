'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// 1. Drop the unique index that references vendor_id
		await queryInterface.sequelize.query("ALTER TABLE models DROP INDEX uq_brand_model_vendor").catch(() => {});

		// 2. Drop the KEY index on vendor_id
		await queryInterface.sequelize.query("ALTER TABLE models DROP INDEX vendor_id").catch(() => {});

		// 3. Clean up duplicate models under the same brand if any exist before adding unique index
		await queryInterface.sequelize.query(`
			DELETE m1 FROM models m1
			INNER JOIN models m2 
			ON m1.brand_id = m2.brand_id 
			  AND m1.name = m2.name 
			  AND m1.id > m2.id
		`).catch(() => {});

		// 4. Drop the vendor_id column
		await queryInterface.sequelize.query("ALTER TABLE models DROP COLUMN vendor_id").catch(() => {});

		// 5. Add new unique index on brand_id and name
		await queryInterface.sequelize.query("ALTER TABLE models ADD UNIQUE KEY uq_brand_model (brand_id, name)").catch(() => {});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.sequelize.query("ALTER TABLE models DROP INDEX uq_brand_model").catch(() => {});

		await queryInterface.addColumn('models', 'vendor_id', {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: 'vendors',
				key: 'id'
			},
			onDelete: 'CASCADE'
		}).catch(() => {});

		await queryInterface.addIndex('models', ['brand_id', 'name', 'vendor_id'], {
			unique: true,
			name: 'uq_brand_model_vendor'
		}).catch(() => {});
	}
};
