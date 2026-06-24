const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Storage = sequelize.define('Storage', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		value: {
			type: DataTypes.STRING(100),
			allowNull: false,
			unique: true,
		},
		status: {
			type: DataTypes.ENUM('pending', 'approved', 'rejected'),
			defaultValue: 'pending',
			allowNull: false,
		},
	}, {
		tableName: 'storages',
		underscored: true,
		timestamps: true,
		updatedAt: false,
	});

	return Storage;
};
