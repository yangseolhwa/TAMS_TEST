const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Profile = sequelize.define('Profile', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  department_id: { type: DataTypes.INTEGER },
  name: { type: DataTypes.STRING(20) },
  mobile_phone: { type: DataTypes.STRING(20) },
  company_rank: { type: DataTypes.STRING(10) },
}, {
  tableName: 'profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Profile;