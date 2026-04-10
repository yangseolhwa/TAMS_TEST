const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
}, {
  tableName: 'departments',
  timestamps: false,
});

module.exports = Department;