const {DataTypes} = require('sequelize');
const sequelize = require('../../config/db');

const AssetEnterprise = sequelize.define('AssetEnterprise', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  asset_number: {type: DataTypes.STRING(100)},
  category_id: {type: DataTypes.INTEGER},
  item_type_id: {type: DataTypes.INTEGER},
  department_id: {type: DataTypes.INTEGER},
  responsible_type: {type: DataTypes.ENUM('personal', 'room', 'vacant', 'place', 'admin', 'other')},
  user_id: {type: DataTypes.INTEGER},
  responsible_value: {type: DataTypes.STRING(100)},
  model_name: {type: DataTypes.STRING(255)},
  state: {type: DataTypes.ENUM('active', 'inactive', 'stored', 'returned')},
  acquisition_date: {type: DataTypes.DATEONLY},
  return_date: {type: DataTypes.DATEONLY},
  manufacturer: {type: DataTypes.STRING(100)},
  spec: {type: DataTypes.STRING(100)},
  serial_number: {type: DataTypes.STRING(100)},
  location: {type: DataTypes.STRING(100)},
  remarks: {type: DataTypes.TEXT},
}, {
  tableName: 'asset_enterprise',
  timestamps: true,
  createdAt: 'created_at', 
  updatedAt: 'updated_at',
})

module.exports = AssetEnterprise;