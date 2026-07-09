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
		tableName: 'storages',
		underscored: true,
		timestamps: true,
		updatedAt: false,
		hooks: {
			afterCreate: async (storage, options) => {
				if (!storage.order_by) {
					await storage.update({ order_by: storage.id }, { transaction: options.transaction });
				}
			}
		}
	});

	return Storage;
};
