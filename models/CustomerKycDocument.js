const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const CustomerKycDocument = sequelize.define(
		"CustomerKycDocument",
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
			},
			document_path: {
				type: DataTypes.STRING(255),
				allowNull: false,
				field: "document_path",
			},
		},
		{
			tableName: "customer_kyc_documents",
			underscored: true,
			timestamps: true,
		}
	);

	return CustomerKycDocument;
};
