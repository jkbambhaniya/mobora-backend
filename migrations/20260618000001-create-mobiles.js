'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("mobiles", {
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
				allowNull: false,
			},
			imei: {
				type: Sequelize.STRING(15),
				allowNull: true,
				unique: true,
			},
			condition: {
				type: Sequelize.ENUM("NEW", "OLD"),
				allowNull: false,
			},

			battery_health: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			status: {
				type: Sequelize.ENUM("Active", "Sold", "Review"),
				allowNull: false,
				defaultValue: "Active",
			},
			description: {
				type: Sequelize.TEXT,
				allowNull: true,
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

		await queryInterface.addIndex("mobiles", ["vendor_id"]);
		await queryInterface.addIndex("mobiles", ["brand_id"]);
		await queryInterface.addIndex("mobiles", ["model_id"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("mobiles");
	},
};
