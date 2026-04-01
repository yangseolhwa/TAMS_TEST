const { DataTypes } = require("sequelize")
const sequelize = require('../../config/db');

const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  token: { type: DataTypes.CHAR(64), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  is_revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  createdAt: 'created_at', 
  updatedAt: 'updated_at',
});

module.exports =RefreshToken;