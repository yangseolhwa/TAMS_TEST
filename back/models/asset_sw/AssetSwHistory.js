const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSwHistory = sequelize.define('AssetSwHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_sw_id: { type: DataTypes.INTEGER },
  license_id: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  change_type: { type: DataTypes.ENUM('register', 'returned', 'change', 'assign') },
  before_value: { type: DataTypes.STRING(255) },
  after_value: { type: DataTypes.STRING(255) },
}, {
  tableName: 'asset_sw_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AssetSwHistory;