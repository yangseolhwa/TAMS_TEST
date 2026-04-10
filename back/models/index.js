const User = require('./user_auth/User');
const RefreshToken = require('./user_auth/RefreshToken');
const Department = require('./user_auth/Department');
const Profile = require('./user_auth/Profile');

const AssetEnterprise = require('./asset_enterprise/AssetEnterprise');
const AssetEnterpriseCategory = require('./asset_enterprise/AssetEnterpriseCategory');
const AssetEnterpriseItemType = require('./asset_enterprise/AssetEnterpriseItemType');
const AssetEnterpriseRequest = require('./asset_enterprise/AssetEnterpriseRequest');
const AssetEnterpriseHistory = require('./asset_enterprise/AssetEnterpriseHistory');
const AssetEnterpriseHistoryArchive = require('./asset_enterprise/AssetEnterpriseHistoryArchive');

const AssetSw = require('./asset_sw/AssetSw');
const AssetSwLicense = require('./asset_sw/AssetSwLicense');
const AssetSwRequest = require('./asset_sw/AssetSwRequest');
const AssetSwHistory = require('./asset_sw/AssetSwHistory');
const AssetSwHistoryArchive = require('./asset_sw/AssetSwHistoryArchive');

const AssetProject = require('./asset_project/AssetProject');
const AssetProjectItem = require('./asset_project/AssetProjectItem');
const AssetProjectItemType = require('./asset_project/AssetProjectItemType');
const AssetProjectHistory = require('./asset_project/AssetProjectHistory');
const AssetProjectHistoryArchive = require('./asset_project/AssetProjectHistoryArchive');

// ── User / Department / Profile ──────────────────────────────────────────────
User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasOne(Profile, { foreignKey: 'user_id', as: 'profile' });
Profile.belongsTo(User, { foreignKey: 'user_id' });

Department.hasMany(Profile, { foreignKey: 'department_id', as: 'profiles' });
Profile.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// ── AssetEnterprise ───────────────────────────────────────────────────────────
User.hasMany(AssetEnterprise, { foreignKey: 'user_id' });
AssetEnterprise.belongsTo(User, { foreignKey: 'user_id' });

AssetEnterprise.belongsTo(AssetEnterpriseCategory, { foreignKey: 'category_id', as: 'item_category' });
AssetEnterprise.belongsTo(AssetEnterpriseItemType, { foreignKey: 'item_type_id', as: 'item_type' });

AssetEnterpriseCategory.hasMany(AssetEnterpriseItemType, { foreignKey: 'category_id', as: 'itemTypes' });
AssetEnterpriseItemType.belongsTo(AssetEnterpriseCategory, { foreignKey: 'category_id', as: 'category' });

AssetEnterprise.hasMany(AssetEnterpriseRequest, { foreignKey: 'asset_id', as: 'requests' });
AssetEnterpriseRequest.belongsTo(AssetEnterprise, { foreignKey: 'asset_id', as: 'asset' });
AssetEnterpriseRequest.belongsTo(User, { foreignKey: 'requester_id', as: 'requester' });

AssetEnterprise.hasMany(AssetEnterpriseHistory, { foreignKey: 'asset_enterprise_id', as: 'histories' });
AssetEnterpriseHistory.belongsTo(AssetEnterprise, { foreignKey: 'asset_enterprise_id', as: 'asset' });
AssetEnterpriseHistory.belongsTo(User, { foreignKey: 'user_id', as: 'changedBy' });

// ── AssetSw ───────────────────────────────────────────────────────────────────
AssetSw.hasMany(AssetSwLicense, { foreignKey: 'asset_sw_id', as: 'licenses' });
AssetSwLicense.belongsTo(AssetSw, { foreignKey: 'asset_sw_id', as: 'asset_sw' });

User.hasMany(AssetSwLicense, { foreignKey: 'user_id' });
AssetSwLicense.belongsTo(User, { foreignKey: 'user_id' });

AssetSw.hasMany(AssetSwRequest, { foreignKey: 'asset_sw_id', as: 'requests' });
AssetSwRequest.belongsTo(AssetSw, { foreignKey: 'asset_sw_id', as: 'sw' });
AssetSwRequest.belongsTo(User, { foreignKey: 'requester_id', as: 'requester' });

AssetSw.hasMany(AssetSwHistory, { foreignKey: 'asset_sw_id', as: 'histories' });
AssetSwHistory.belongsTo(AssetSw, { foreignKey: 'asset_sw_id', as: 'sw' });
AssetSwHistory.belongsTo(AssetSwLicense, { foreignKey: 'license_id', as: 'license' });
AssetSwHistory.belongsTo(User, { foreignKey: 'user_id', as: 'changedBy' });

// ── AssetProject ──────────────────────────────────────────────────────────────
AssetProject.hasMany(AssetProjectItem, { foreignKey: 'project_id', as: 'items' });
AssetProjectItem.belongsTo(AssetProject, { foreignKey: 'project_id', as: 'project' });

AssetProjectItem.belongsTo(AssetProjectItemType, { foreignKey: 'asset_type_id', as: 'item_type' });
AssetProjectItemType.hasMany(AssetProjectItem, { foreignKey: 'asset_type_id', as: 'items' });

// AssetProjectItemType 자기 참조 (대분류 / 소분류)
AssetProjectItemType.hasMany(AssetProjectItemType, { foreignKey: 'parent_id', as: 'children' });
AssetProjectItemType.belongsTo(AssetProjectItemType, { foreignKey: 'parent_id', as: 'parent' });

User.hasMany(AssetProjectItem, { foreignKey: 'user_id', as: 'projectItems' });
AssetProjectItem.belongsTo(User, { foreignKey: 'user_id', as: 'manager' });

AssetProjectItem.hasMany(AssetProjectHistory, { foreignKey: 'asset_project_item_id', as: 'histories' });
AssetProjectHistory.belongsTo(AssetProjectItem, { foreignKey: 'asset_project_item_id', as: 'item' });
AssetProjectHistory.belongsTo(AssetProject, { foreignKey: 'project_id', as: 'project' });
AssetProjectHistory.belongsTo(User, { foreignKey: 'user_id', as: 'changedBy' });

module.exports = {
  User, RefreshToken, Department, Profile,
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseRequest, AssetEnterpriseHistory, AssetEnterpriseHistoryArchive,
  AssetSw, AssetSwLicense, AssetSwRequest, AssetSwHistory, AssetSwHistoryArchive,
  AssetProject, AssetProjectItem, AssetProjectItemType,
  AssetProjectHistory, AssetProjectHistoryArchive,
};