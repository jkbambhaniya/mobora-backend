const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Brand = sequelize.define(
        "Brand",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            slug: {
                type: DataTypes.STRING,
                allowNull: true,
                unique: true,
            },
            status: {
                type: DataTypes.ENUM("pending", "active", "inactive"),
                defaultValue: "pending",
                allowNull: false,
            },
        },
        {
            tableName: "brands",
            underscored: true,
            timestamps: true,
            updatedAt: false,
        },
    );

	return Brand;
};
