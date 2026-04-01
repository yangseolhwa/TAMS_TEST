const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProjectItem = sequelize.define('AssetProjectItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  project_id: { type: DataTypes.INTEGER },
  item_number: { type: DataTypes.INTEGER },
  asset_type_id: { type: DataTypes.INTEGER },
  owner_organization: { type: DataTypes.STRING(100) },
  equipment_number: { type: DataTypes.STRING(100) },
  manufacturer: { type: DataTypes.STRING(100) },
  model_name: { type: DataTypes.STRING(100) },
  serial_number: { type: DataTypes.STRING(255) },
  spec: { type: DataTypes.STRING(100) },
  acquisition_date: { type: DataTypes.DATEONLY },
  return_date: { type: DataTypes.DATEONLY },
  state: { type: DataTypes.ENUM('in_use', 'stored', 'rented', 'returned') },
  location: { type: DataTypes.STRING(100) },
  remarks: { type: DataTypes.STRING(255) },
}, {
  tableName: 'asset_project_item',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetProjectItem;