const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSwHistoryArchive = sequelize.define('AssetSwHistoryArchive', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  history_id: { type: DataTypes.INTEGER },
  asset_sw_id: { type: DataTypes.INTEGER },
  license_id: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  change_type: { type: DataTypes.ENUM('register', 'returned', 'change', 'assign') },
  before_value: { type: DataTypes.STRING(255) },
  after_value: { type: DataTypes.STRING(255) },
  archived_at: { type: DataTypes.DATE },
  archived_by: { type: DataTypes.INTEGER },
  archive_range: { type: DataTypes.STRING(50) },
}, {
  tableName: 'asset_sw_history_archive',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AssetSwHistoryArchive;