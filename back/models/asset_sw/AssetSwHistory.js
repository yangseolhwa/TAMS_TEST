const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AssetSwHistory = sequelize.define('AssetSwHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_sw_id: { type: DataTypes.INTEGER },
  license_id: { type: DataTypes.INTEGER },
  user_id: { type: DataTypes.INTEGER },
  change_type: {
    type: DataTypes.ENUM(
      'register',  // 등록 완료 (승인 후 or admin 직접)
      'returned',  // 반납
      'change',    // 상태 변경
      'assign',    // 할당 완료
      'request',   // 등록/할당 요청 생성 (user pending)
      'rejected',  // 요청 반려 (admin)
    ),
  },
  before_value: { type: DataTypes.STRING(255) },
  after_value: { type: DataTypes.STRING(255) },
}, {
  tableName: 'asset_sw_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AssetSwHistory;