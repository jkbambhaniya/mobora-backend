'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("device_requirements", {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
				allowNull: false,
			},
			vendor_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "vendors",
					key: "id",
				},
				onDelete: "CASCADE",
			},
			brand_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "brands",
					key: "id",
				},
				onDelete: "RESTRICT",
			},
			model_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "models",
					key: "id",
				},
				onDelete: "RESTRICT",
			},
			storage_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "storages",
					key: "id",
				},
				onDelete: "RESTRICT",
			},
			ram_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "rams",
					key: "id",
				},
				onDelete: "RESTRICT",
			},
			color: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			status: {
				type: Sequelize.STRING(50),
				allowNull: false,
				defaultValue: "Active",
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
			},
		});

		await queryInterface.addIndex("device_requirements", ["vendor_id"]);
		await queryInterface.addIndex("device_requirements", ["brand_id"]);
		await queryInterface.addIndex("device_requirements", ["model_id"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("device_requirements");
	},
};
