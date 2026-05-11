const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSw = sequelize.define('AssetSw', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  version: { type: DataTypes.STRING(100) },
  manufacturer: { type: DataTypes.STRING(100) },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  acquisition_date: { type: DataTypes.DATEONLY },
  license_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sw_type: {
    type: DataTypes.ENUM('subscription', 'license'),
    allowNull: false,
    defaultValue: 'license',
    comment: 'subscription: 키 없는 구독형 (자리수 관리) | license: 키 있는 라이선스 (영구/갱신 모두 포함)',
  },
  state: { type: DataTypes.ENUM('in_use', 'available', 'returned') },
  related_link: { type: DataTypes.STRING(2048), allowNull: true },
  remarks: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'asset_sw',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AssetSw;