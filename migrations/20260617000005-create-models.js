'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("models", {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            brand_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "brands",
                    key: "id",
                },
                onDelete: "CASCADE",
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            slug: {
                type: Sequelize.STRING,
                allowNull: true,
                unique: true,
            },
            vendor_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: "vendors",
                    key: "id",
                },
                onDelete: "CASCADE",
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

		await queryInterface.addIndex('models', ['brand_id', 'name', 'vendor_id'], {
			unique: true,
			name: 'uq_brand_model_vendor'
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('models');
	}
};
