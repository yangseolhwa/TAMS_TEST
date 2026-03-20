const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetEnterpriseRequest = sequelize.define('AssetEnterpriseRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_id: { type: DataTypes.INTEGER },
  requester_id: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected') },
  required_quantity: { type: DataTypes.INTEGER },
  request_date: { type: DataTypes.DATEONLY },
  request_reason: { type: DataTypes.STRING(255) },
  new_asset_data: { type: DataTypes.TEXT },
  admin_reason: { type: DataTypes.STRING(255) },
  request_type: { type: DataTypes.ENUM('register', 'return') },
  processed_at: { type: DataTypes.DATE },
}, {
  tableName: 'asset_enterprise_request',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetEnterpriseRequest;