const asyncWrapper = require('../middleware/asyncWrapper');
const {
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetSw, AssetSwLicense,
  AssetProject, AssetProjectItem, AssetProjectItemType,
  User,
} = require('../models');

// 개인 자산 조회(enterprise + sw)
exports.getPersonalAssets = asyncWrapper(async (req, res) => {
  const {userId, role} = req.user;

  // 내 자산 조회 조건 (일반회원: 개인 자산, 관리자: 전체 자산)
  const enterpriseWhere = role === 'admin' ? {} : { user_id: userId };
  const swLicenseWhere = role === 'admin' ? {} : { user_id: userId };

  const enterpriseAsset = await AssetEnterprise.findAll({
    where: enterpriseWhere,
    include: [
      { model: AssetEnterpriseCategory, as: 'category', attributes: ['id', 'name']},
      { model: AssetEnterpriseItemType, as: 'itemType', attributes: ['id', 'name']},
      { model: User, attributes: ['id', 'email']},
    ],
    order: [['created_at', 'DESC']],
  });

  const swLicense = await AssetSwLicense.findAll({
    where: swLicenseWhere,
    include: [
      { model: AssetSw, as: 'sw', attributes: ['id', 'name', 'software_type', 'manufacturer', 'is_subscription', 'state']},
      { model: User, attributes: ['id', 'email']},
    ],
    order: [['created_at', 'DESC']]
  });

  res.status(200).json({
    enterprise: enterpriseAsset,
    sw: swLicense,
  });
});

// DF 자산 조회
exports.getDfAssets = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;

  const projectWhere = role === 'admin' ? {} : { user_id: userId };

  const projects = await AssetProject.findAll({
    where: projectWhere,
    include: [
      { 
        model: AssetProjectItem,
        as: 'items',
        include: [
          { model: AssetProjectItemType, as: 'itemType', attributes: ['id', 'name', 'is_cable']},
        ],
      },
      { model: User, attributes: ['id', 'email']},
    ],
    order: [['created_at', 'DESC']],
  });
  
  res.status(200).json({ projects });
});
