const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProject = sequelize.define('AssetProject', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  name: {type: DataTypes.STRING(100)},
  description: {type: DataTypes.STRING(255)},
  start_date: {type: DataTypes.DATE},
  end_date: {type: DataTypes.DATE},
}, {
  tableName: 'asset_project',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

module.exports = AssetProject;