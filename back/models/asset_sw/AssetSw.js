const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSw = sequelize.define('AssetSw', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  version: { type: DataTypes.STRING(100) },
  manufacturer: { type: DataTypes.STRING(100) },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  acquisition_date: { type: DataTypes.DATEONLY },
  license_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  state: { type: DataTypes.ENUM('in_use', 'available', 'returned') },
  related_link: { type: DataTypes.STRING(2048), allowNull: true },
  remarks: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'asset_sw',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetSw;