'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("blacklisted_mobiles", {
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
			imei: {
				type: Sequelize.STRING(15),
				allowNull: false,
				unique: true,
			},
			reason: {
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

		await queryInterface.addIndex("blacklisted_mobiles", ["vendor_id"]);
		await queryInterface.addIndex("blacklisted_mobiles", ["imei"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("blacklisted_mobiles");
	},
};
