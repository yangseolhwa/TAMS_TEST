const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetEnterprise = sequelize.define('AssetEnterprise', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_number: { type: DataTypes.STRING(100) },
  category_id: { type: DataTypes.INTEGER },
  item_type_id: { type: DataTypes.INTEGER },
  department_id: { type: DataTypes.INTEGER },
  responsible_type: { type: DataTypes.ENUM('personal', 'place', 'vacant', 'shred') },
  user_id: { type: DataTypes.INTEGER },
  responsible_value: { type: DataTypes.STRING(100) },
  state: { type: DataTypes.ENUM('in_use', 'stored', 'returned') },
  acquisition_date: { type: DataTypes.DATEONLY },
  manufacturer: { type: DataTypes.STRING(100) },
  spec: { type: DataTypes.STRING(200) },
  serial_number: { type: DataTypes.STRING(100) },
  location: { type: DataTypes.STRING(100) },
  remarks: { type: DataTypes.TEXT },
}, {
  tableName: 'asset_enterprise',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetEnterprise;