const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	const Ram = sequelize.define('Ram', {
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
			type: DataTypes.STRING(50),
			defaultValue: 'pending',
		},
	}, {
		tableName: 'rams',
		underscored: true,
		timestamps: true,
		updatedAt: false,
	});

	return Ram;
};
