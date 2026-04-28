const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSwRequest = sequelize.define('AssetSwRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_sw_id: { type: DataTypes.INTEGER },
  requester_id: { type: DataTypes.INTEGER },
  required_quantity: { type: DataTypes.INTEGER },
  request_date: { type: DataTypes.DATEONLY },
  request_reason: { type: DataTypes.STRING(255) },
  new_asset_data: { type: DataTypes.TEXT },
  request_type: { type: DataTypes.ENUM('register', 'return', 'assign') },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected') },
  processed_at: { type: DataTypes.DATE },
}, {
  tableName: 'asset_sw_request',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetSwRequest;