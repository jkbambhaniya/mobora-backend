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
		order_by: {
			type: DataTypes.INTEGER,
			allowNull: true,
			field: 'order_by',
		},
		status: {
			type: DataTypes.ENUM('pending', 'active', 'inactive'),
			defaultValue: 'pending',
			allowNull: false,
		},
	}, {
		tableName: 'rams',
		underscored: true,
		timestamps: true,
		updatedAt: false,
		hooks: {
			afterCreate: async (ram, options) => {
				if (!ram.order_by) {
					await ram.update({ order_by: ram.id }, { transaction: options.transaction });
				}
			}
		}
	});

	return Ram;
};
