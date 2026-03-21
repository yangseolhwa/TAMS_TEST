const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProjectItemType = sequelize.define('AssetProjectItemType', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  name: {type: DataTypes.STRING(100)},
  is_cable: {type: DataTypes.BOOLEAN}
}, {
  tableName: 'asset_project_item_type',
  timestamps: false
});

module.exports = AssetProjectItemType;