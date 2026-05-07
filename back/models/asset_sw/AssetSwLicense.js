const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSwLicense = sequelize.define('AssetSwLicense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_sw_id: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  user_note: { type: DataTypes.STRING(100), allowNull: true },
  license_key: { type: DataTypes.STRING(255), allowNull: true },
  license_password: { type: DataTypes.STRING(255) },
  key_type: { type: DataTypes.ENUM('serial', 'credential'), allowNull: true },
  license_type: { type: DataTypes.ENUM('per_seat', 'shared'), allowNull: false, defaultValue: 'per_seat' },
  state: { type: DataTypes.ENUM('in_use', 'available') },
  issue_date: { type: DataTypes.DATEONLY, allowNull: true },
}, {
  tableName: 'asset_sw_license',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetSwLicense;