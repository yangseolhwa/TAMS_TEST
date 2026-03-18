const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSwLicense = sequelize.define('AssetSwLicense', {
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  asset_sw_id: {type: DataTypes.INTEGER},
  user_id: {type: DataTypes.INTEGER},
  subscription_date: {type: DataTypes.DATEONLY},
  license_key: {type: DataTypes.STRING(255)},
  license_password: {type: DataTypes.STRING(255)},
  key_type: {type: DataTypes.ENUM('serial', 'url', 'credential', 'other')},
  related_link: {
    type: DataTypes.STRING(2048),
    allowNull: true,
    validate: {
      isUrl: {
        msg: '유효한 URL 형식이 아닙니다.'
      }
    }
  },
}, {
  tableName: 'asset_sw_license',
  timestamp: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = AssetSwLicense;