const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetEnterpriseCategory = sequelize.define('AssetEnterpriseCategory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.ENUM('office', 'furniture', 'industrial', 'electrical'), allowNull: false },
}, {
  tableName: 'asset_enterprise_category',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetEnterpriseCategory;