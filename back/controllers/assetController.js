const { Op } = require('sequelize');

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

  // 쿼리스트링 파싱
  const { type, category_id, state, keyword, software_type } = req.query;

  // 필터 검증
  const validTypes = ['enterprise', 'sw'];
  const validStates = {
    enterprise: ['active', 'stored'],
    sw: ['active', 'expiring', 'stored']
  };
  const validSoftwareTypes = ['dev', 'design', 'collaboration', 'security', 'other'];
  
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ message: '유효하지 않은 자산 유형입니다.' });
  }
  if (state && type && !validStates[type].includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다.' });
  }
  if (category_id && isNaN(Number(category_id))) {
    return res.status(400).json({ message: '유효하지 않은 카테고리 ID입니다.' });
  }
  if (software_type && !validSoftwareTypes.includes(software_type)) {
    return res.status(400).json({ message: '유효하지 않은 소프트웨어 유형입니다. '});
  }

  // -- enterprise 자산 조회
  let enterpriseAssets = [];
  if (!type || type === 'enterprise') {
    const enterpriseWhere = role === 'admin' ? {} : { user_id: userId };
    // 카테고리 필터
    if (category_id) {
      enterpriseWhere.category_id = Number(category_id);
    }
    // state 필터
    if (state) {
      enterpriseWhere.state = state;
    }
    // keyword 검색
    if (keyword) {
      enterpriseWhere[Op.or] = [
        { asset_number:   { [Op.like]: `%${keyword}%` } },
        { manufacturer:   { [Op.like]: `%${keyword}%` } },
        { serial_number:  { [Op.like]: `%${keyword}%` } },
        { spec:           { [Op.like]: `%${keyword}%` } },
        { location:       { [Op.like]: `%${keyword}%` } },
        { responsible_value: { [Op.like]: `%${keyword}%` } },
      ];
    }

    enterpriseAssets = await AssetEnterprise.findAll({
      where: enterpriseWhere,
      include: [
        { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name']},
        { model: AssetEnterpriseItemType, as: 'item_type', attributes: ['id', 'name']},
        { model: User, attributes: ['id', 'email']},
      ],
      order: [['created_at', 'DESC']],
    });
  }

  // -- sw 조회
  let swAssets = [];
  if (!type || type === 'sw') {

    // sw 조건
    const swWhere = {};
    if (state) {
      swWhere.state = state;
    }
    if (software_type) {
      swWhere.software_type = software_type;
    }
    if (keyword) {
      swWhere[Op.or] = [
        { name:         { [Op.like]: `%${keyword}%` } },
        { manufacturer: { [Op.like]: `%${keyword}%` } },
      ];
    }

    // license 조건 (일반회원: 본인 라이선스만, 관리자: 전체)
    const licenseWhere = role === 'admin' ? {} : { user_id: userId };

    swAssets = await AssetSw.findAll({
      where: swWhere,
      include: [
        {
          model: AssetSwLicense,
          as: 'licenses',
          where: Object.keys(licenseWhere).length > 0 ? licenseWhere : undefined,
          required: role === 'admin' ? false : true, // ← 일반회원은 본인 라이선스 없으면 SW 제외
          include: [
            { model: User, attributes: ['id', 'email'] },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  res.status(200).json({
    enterprise: enterpriseAssets,
    sw: swAssets,
  });
});


// DF 자산 조회
exports.getDfAssets = asyncWrapper(async (req, res) => {
  const projects = await AssetProject.findAll({
    include: [
      { 
        model: AssetProjectItem,
        as: 'items',
        include: [
          { model: AssetProjectItemType, as: 'itemType', attributes: ['id', 'name', 'is_cable']},
          { model: User, as: 'manager', attributes: ['id', 'email']},
        ],
      },
    ],
    order: [['created_at', 'DESC']],
  });
  
  res.status(200).json({ projects });
});
