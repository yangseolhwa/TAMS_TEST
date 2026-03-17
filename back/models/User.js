const { DataTypes } = require('sequelize');
const sequlize = require('../config/db');

const User = sequlize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  role: { type: DataTypes.ENUM('admin', 'user'), allowNull: false, defaultValue: 'user' },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at', 
  updatedAt: 'updated_at',
});

module.exports = User;