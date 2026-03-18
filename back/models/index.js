const User = require('./user_auth/User');
const RefreshToken = require('./user_auth/RefreshToken');
const AssetEnterprise         = require('./asset_enterprise/AssetEnterprise');
const AssetEnterpriseCategory = require('./asset_enterprise/AssetEnterpriseCategory');
const AssetEnterpriseItemType = require('./asset_enterprise/AssetEnterpriseItemType');
const AssetEnterpriseRequest  = require('./asset_enterprise/AssetEnterpriseRequest');
const AssetSw                 = require('./asset_sw/AssetSw');
const AssetSwLicense          = require('./asset_sw/AssetSwLicense');
const AssetSwRequest          = require('./asset_sw/AssetSwRequest');
const AssetProject            = require('./asset_project/AssetProject');
const AssetProjectItem        = require('./asset_project/AssetProjectItem');
const AssetProjectItemType    = require('./asset_project/AssetProjectItemType');
const AssetProjectHistory     = require('./asset_project/AssetProjectHistory');

// ── User 관계 ──
User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AssetEnterprise, { foreignKey: 'user_id' });
AssetEnterprise.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AssetSwLicense, { foreignKey: 'user_id' });
AssetSwLicense.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AssetProject, { foreignKey: 'user_id' });
AssetProject.belongsTo(User, { foreignKey: 'user_id' });

// ── AssetEnterprise 관계 ──
AssetEnterprise.belongsTo(AssetEnterpriseCategory, { foreignKey: 'category_id',  as: 'category' });
AssetEnterprise.belongsTo(AssetEnterpriseItemType, { foreignKey: 'item_type_id', as: 'itemType' });

AssetEnterpriseCategory.hasMany(AssetEnterpriseItemType, { foreignKey: 'category_id' });
AssetEnterpriseItemType.belongsTo(AssetEnterpriseCategory, { foreignKey: 'category_id' });

AssetEnterprise.hasMany(AssetEnterpriseRequest, { foreignKey: 'asset_id',      as: 'requests' });
AssetEnterpriseRequest.belongsTo(AssetEnterprise, { foreignKey: 'asset_id',      as: 'asset' });
AssetEnterpriseRequest.belongsTo(User, { foreignKey: 'requester_id',  as: 'requester' });

// ── AssetSw 관계 ──
AssetSw.hasMany(AssetSwLicense, { foreignKey: 'asset_sw_id', as: 'licenses' });
AssetSwLicense.belongsTo(AssetSw, { foreignKey: 'asset_sw_id', as: 'sw' });

AssetSw.hasMany(AssetSwRequest, { foreignKey: 'asset_sw_id', as: 'requests' });
AssetSwRequest.belongsTo(AssetSw, { foreignKey: 'asset_sw_id', as: 'sw' });
AssetSwRequest.belongsTo(User, { foreignKey: 'requester_id', as: 'requester' });

// ── AssetProject 관계 ──
AssetProject.hasMany(AssetProjectItem, { foreignKey: 'project_id', as: 'items' });
AssetProjectItem.belongsTo(AssetProject, { foreignKey: 'project_id', as: 'project' });

AssetProjectItem.belongsTo(AssetProjectItemType, { foreignKey: 'asset_type_id', as: 'itemType' });
AssetProjectItemType.hasMany(AssetProjectItem, { foreignKey: 'asset_type_id' });

AssetProjectItem.hasMany(AssetProjectHistory, { foreignKey: 'asset_project_item_id', as: 'histories' });
AssetProjectHistory.belongsTo(AssetProjectItem, { foreignKey: 'asset_project_item_id', as: 'item' });
AssetProjectHistory.belongsTo(AssetProject, { foreignKey: 'project_id',            as: 'project' });
AssetProjectHistory.belongsTo(User, { foreignKey: 'change_by',             as: 'changedBy' });

module.exports = {
  User, RefreshToken,
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType, AssetEnterpriseRequest,
  AssetSw, AssetSwLicense, AssetSwRequest,
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
};
