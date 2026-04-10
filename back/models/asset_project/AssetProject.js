const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProject = sequelize.define('AssetProject', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  name: {type: DataTypes.STRING(100)},
}, {
  tableName: 'asset_project',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

module.exports = AssetProject;