const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetEnterpriseHistory = sequelize.define('AssetEnterpriseHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_enterprise_id: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  change_type: { type: DataTypes.ENUM('register', 'returned', 'change', 'move', 'assign') },
  before_value: { type: DataTypes.STRING(255) },
  after_value: { type: DataTypes.STRING(255) },
}, {
  tableName: 'asset_enterprise_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AssetEnterpriseHistory;