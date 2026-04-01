const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetProjectHistoryArchive = sequelize.define('AssetProjectHistoryArchive', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  history_id: { type: DataTypes.INTEGER },
  asset_project_item_id: { type: DataTypes.INTEGER },
  project_id: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  change_type: { type: DataTypes.ENUM('register', 'returned', 'move', 'change') },
  before_value: { type: DataTypes.STRING(255) },
  after_value: { type: DataTypes.STRING(255) },
  archived_at: { type: DataTypes.DATE },
  archived_by: { type: DataTypes.INTEGER },
  archive_range: { type: DataTypes.STRING(50) },
}, {
  tableName: 'asset_project_history_archive',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AssetProjectHistoryArchive;