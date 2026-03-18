const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetEnterpriseItemType = sequelize.define('AssetEnterpriseItemType', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  category_id: {type: DataTypes.INTEGER},
  name: {type: DataTypes.STRING(50)},
}, {
  tableName: 'asset_enterprise_item_type',
  timestamps: false,
  createdAt: 'created_at', 
  updatedAt: 'updated_at',
});

module.exports = AssetEnterpriseItemType;