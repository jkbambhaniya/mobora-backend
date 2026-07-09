const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const DeviceModel = sequelize.define(
        "Model",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            brand_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "brand_id",
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            slug: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM('pending', 'active', 'inactive'),
                defaultValue: 'pending',
                allowNull: false,
            },
        },
        {
            tableName: "models",
            underscored: true,
            timestamps: true,
            updatedAt: false,
        },
    );

	return DeviceModel;
};
