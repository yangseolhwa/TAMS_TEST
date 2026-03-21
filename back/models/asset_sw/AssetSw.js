const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSw = sequelize.define('AssetSw', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  name: {type: DataTypes.STRING(255)},
  software_type: {type: DataTypes.ENUM('dev', 'design', 'collaboration', 'security', 'other')},
  manufacturer: {type: DataTypes.STRING(100)},
  is_subscription: {type: DataTypes.BOOLEAN},
  state: {type: DataTypes.ENUM('active', 'stored', 'expiring')},
}, {
  tableName: 'asset_sw',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = AssetSw;