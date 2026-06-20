'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// 1. Temporarily expand ENUM values to prevent errors during mapping
		await queryInterface.changeColumn("mobiles", "condition", {
			type: Sequelize.ENUM("Mint", "Excellent", "Good", "Fair", "NEW", "OLD"),
			allowNull: false,
		});

		// 2. Map existing data: Mint/Excellent -> NEW, Good/Fair -> OLD
		await queryInterface.sequelize.query(
			"UPDATE mobiles SET `condition` = 'NEW' WHERE `condition` IN ('Mint', 'Excellent')"
		);
		await queryInterface.sequelize.query(
			"UPDATE mobiles SET `condition` = 'OLD' WHERE `condition` IN ('Good', 'Fair')"
		);

		// 3. Narrow the ENUM values to only NEW and OLD
		await queryInterface.changeColumn("mobiles", "condition", {
			type: Sequelize.ENUM("NEW", "OLD"),
			allowNull: false,
		});
	},

	down: async (queryInterface, Sequelize) => {
		// 1. Expand the ENUM values to include all possibilities for reverting
		await queryInterface.changeColumn("mobiles", "condition", {
			type: Sequelize.ENUM("Mint", "Excellent", "Good", "Fair", "NEW", "OLD"),
			allowNull: false,
		});

		// 2. Map data back (optional/best-effort mapping: NEW -> Excellent, OLD -> Good)
		await queryInterface.sequelize.query(
			"UPDATE mobiles SET `condition` = 'Excellent' WHERE `condition` = 'NEW'"
		);
		await queryInterface.sequelize.query(
			"UPDATE mobiles SET `condition` = 'Good' WHERE `condition` = 'OLD'"
		);

		// 3. Set back to original ENUM
		await queryInterface.changeColumn("mobiles", "condition", {
			type: Sequelize.ENUM("Mint", "Excellent", "Good", "Fair"),
			allowNull: false,
		});
	}
};
