const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProjectItem = sequelize.define('AssetProjectItem', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  project_id: {type: DataTypes.INTEGER},
  item_number: {type: DataTypes.INTEGER},
  asset_type_id: {type: DataTypes.INTEGER},
  doosan_item_number: {type: DataTypes.STRING(255)},
  manufacturer: {type: DataTypes.STRING(100)},
  model_name: {type: DataTypes.STRING(255)},
  serial_number: {type: DataTypes.STRING(255)},
  spec: {type: DataTypes.STRING(100)},
  quantity: {type: DataTypes.INTEGER},
  quantity_unit: {type: DataTypes.ENUM('ea', 'set', 'etc')},
  rental_start_date: {type: DataTypes.DATE},
  rental_end_date: {type: DataTypes.DATE},
  state: {type: DataTypes.ENUM('active', 'stored', 'rented')},
  location: {type: DataTypes.STRING(100)},
  remarks: {type: DataTypes.STRING(255)},
}, {
  tableName: 'asset_project_item',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = AssetProjectItem;