const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const CustomerKyc = sequelize.define(
		"CustomerKyc",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			customer_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "customer_id",
				unique: true,
			},
			id_type: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: "id_type",
			},
			id_number: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: "id_number",
			},
			kyc_status: {
				type: DataTypes.ENUM("Pending", "Verified", "Rejected"),
				defaultValue: "Verified",
				field: "kyc_status",
			},
			kyc_document_img: {
				type: DataTypes.TEXT("long"),
				allowNull: true,
				field: "kyc_document_img",
			},
			verified_at: {
				type: DataTypes.DATE,
				allowNull: true,
				field: "verified_at",
			},
		},
		{
			tableName: "customer_kycs",
			underscored: true,
			timestamps: true,
		},
	);

	return CustomerKyc;
};
