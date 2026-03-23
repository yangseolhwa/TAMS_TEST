const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProjectHistory = sequelize.define('AssetProjectHistory', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  asset_project_item_id: {type: DataTypes.INTEGER},
  project_id: {type: DataTypes.INTEGER},
  change_by: {type: DataTypes.INTEGER},
  change_type: {type: DataTypes.ENUM('register', 'return', 'move')},
  location_before: {type: DataTypes.STRING(100)},
  location_after: {type: DataTypes.STRING(100)},
  rental_start_date: {type: DataTypes.DATE},
  rental_end_date: {type: DataTypes.DATE},
  state: {type: DataTypes.ENUM('active', 'stored', 'rented', 'returned')},
}, {
  tableName: 'asset_project_history',
  timestamps: true,
  createdAt: 'created_at',
});

module.exports = AssetProjectHistory;