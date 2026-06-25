const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const BlacklistedMobile = sequelize.define(
		"BlacklistedMobile",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			vendor_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "vendor_id",
			},
			imei: {
				type: DataTypes.STRING(15),
				allowNull: false,
				unique: true,
			},
			reason: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
		},
		{
			tableName: "blacklisted_mobiles",
			underscored: true,
			timestamps: true,
		},
	);

	return BlacklistedMobile;
};
