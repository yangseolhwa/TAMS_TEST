const { Op } = require('sequelize');
const sequelize = require('../config/db');
const asyncWrapper = require('../middleware/asyncWrapper');
const {
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseRequest, AssetEnterpriseHistory,
  AssetSw, AssetSwLicense, AssetSwRequest, AssetSwHistory,
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
  User, Department, Profile
} = require('../models');

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────
const VALID_ENTERPRISE_STATES = ['in_use', 'stored', 'returned'];
const VALID_SW_STATES         = ['in_use', 'available', 'returned'];
const VALID_DF_STATES         = ['in_use', 'stored', 'rented'];


// ─────────────────────────────────────────
// 개인 자산 조회 (enterprise + sw)
// ─────────────────────────────────────────
exports.getPersonalAssets = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { type, category_id, state, keyword } = req.query;

  if (type && !['enterprise', 'sw'].includes(type)) {
    return res.status(400).json({ message: '유효하지 않은 자산 유형입니다.' });
  }
  if (state) {
    const allowedStates = type === 'sw'
      ? VALID_SW_STATES
      : type === 'enterprise'
        ? VALID_ENTERPRISE_STATES
        : [...VALID_ENTERPRISE_STATES, ...VALID_SW_STATES];
    if (!allowedStates.includes(state)) {
      return res.status(400).json({ message: '유효하지 않은 상태값입니다.' });
    }
  }
  if (category_id && isNaN(Number(category_id))) {
    return res.status(400).json({ message: '유효하지 않은 카테고리 ID입니다.' });
  }

  // enterprise 조회 (returned 제외)
  let enterprise = [];
  if (!type || type === 'enterprise') {
    const where = role === 'admin'
      ? { state: { [Op.ne]: 'returned' } }
      : { user_id: userId, state: { [Op.ne]: 'returned' } };
    if (category_id) where.category_id = Number(category_id);
    if (state)       where.state       = state;
    if (keyword) {
      where[Op.or] = [
        { asset_number:      { [Op.like]: `%${keyword}%` } },
        { manufacturer:      { [Op.like]: `%${keyword}%` } },
        { serial_number:     { [Op.like]: `%${keyword}%` } },
        { spec:              { [Op.like]: `%${keyword}%` } },
        { location:          { [Op.like]: `%${keyword}%` } },
      ];
    }
    enterprise = await AssetEnterprise.findAll({
      where,
      include: [
        { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
        { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name', 'code'] },
        { model: User,                                          attributes: ['id', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  // sw 조회 (asset_sw.state = returned 제외)
  let sw = [];
  if (!type || type === 'sw') {
    const swWhere = { state: { [Op.ne]: 'returned' } };
    if (state)   swWhere.state = state;
    if (keyword) {
      swWhere[Op.or] = [
        { name:         { [Op.like]: `%${keyword}%` } },
        { manufacturer: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const licenseWhere = role === 'admin' ? {} : { user_id: userId };

    sw = await AssetSw.findAll({
      where: swWhere,
      include: [{
        model: AssetSwLicense,
        as: 'licenses',
        where: Object.keys(licenseWhere).length > 0 ? licenseWhere : undefined,
        required: role !== 'admin',
        include: [{ model: User, attributes: ['id', 'email'] }],
      }],
      order: [['created_at', 'DESC']],
    });
  }

  res.status(200).json({ enterprise, sw });
});


// ─────────────────────────────────────────
// DF 자산 조회
// ─────────────────────────────────────────
exports.getDfAssets = asyncWrapper(async (req, res) => {
  const { project_id, item_type_id, manufacturer, state, keyword } = req.query;

  if (state && !VALID_DF_STATES.includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다.' });
  }
  if (project_id   && isNaN(Number(project_id)))   return res.status(400).json({ message: '유효하지 않은 프로젝트 ID입니다.' });
  if (item_type_id && isNaN(Number(item_type_id))) return res.status(400).json({ message: '유효하지 않은 자산 종류 ID입니다.' });

  const projectWhere = project_id ? { id: Number(project_id) } : {};

  const itemWhere = { state: { [Op.ne]: 'returned' } };
  if (state)        itemWhere.state         = state;
  if (manufacturer) itemWhere.manufacturer  = { [Op.like]: `%${manufacturer}%` };
  if (item_type_id) itemWhere.asset_type_id = Number(item_type_id);
  if (keyword) {
    itemWhere[Op.or] = [
      { model_name:         { [Op.like]: `%${keyword}%` } },
      { serial_number:      { [Op.like]: `%${keyword}%` } },
      { spec:               { [Op.like]: `%${keyword}%` } },
      { location:           { [Op.like]: `%${keyword}%` } },
      { owner_organization: { [Op.like]: `%${keyword}%` } },
      { equipment_number:   { [Op.like]: `%${keyword}%` } },
    ];
  }

  const projects = await AssetProject.findAll({
    where: projectWhere,
    include: [{
      model: AssetProjectItem,
      as: 'items',
      where: itemWhere,
      required: true,
      include: [
        { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name', 'parent_id'] },
        { model: User,                 as: 'manager',   attributes: ['id', 'email'] },
      ],
    }],
    order: [['created_at', 'DESC']],
  });

  res.status(200).json({ projects });
});


// ─────────────────────────────────────────
// Enterprise 자산 등록
// ─────────────────────────────────────────
exports.registerEnterprise = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  let { is_existing, assets } = req.body;

  if (assets && !Array.isArray(assets)) assets = [assets];
  if (!assets || assets.length === 0) {
    return res.status(400).json({ message: '등록할 자산 정보를 입력해주세요.' });
  }

  const maxCount = role === 'admin' ? 1 : 5;
  if (assets.length > maxCount) {
    return res.status(400).json({ message: `최대 ${maxCount}개까지 등록할 수 있습니다.` });
  }

  for (const asset of assets) {
    if (is_existing) {
      if (!asset.asset_id) return res.status(400).json({ message: '기존 자산 ID를 선택해주세요.' });
      const existing = await AssetEnterprise.findByPk(asset.asset_id);
      if (!existing) return res.status(404).json({ message: `ID ${asset.asset_id}에 해당하는 자산이 없습니다.` });
    } else {
      if (!asset.asset_number || !asset.category_id || !asset.item_type_id || !asset.manufacturer) {
        return res.status(400).json({ message: '자산번호, 카테고리, 자산 종류, 제조사는 필수 입력 항목입니다.' });
      }
    }
    if (!asset.acquisition_date) {
      return res.status(400).json({ message: '취득일은 필수 입력 항목입니다.' });
    }
  }

  // 관리자 → 즉시 in_use 등록
  if (role === 'admin') {
    let assetData;
    if (is_existing) {
      const original = await AssetEnterprise.findByPk(assets[0].asset_id);
      assetData = {
        category_id:       original.category_id,
        item_type_id:      original.item_type_id,
        asset_number:      assets[0].asset_number      ?? original.asset_number,
        manufacturer:      assets[0].manufacturer      ?? original.manufacturer,
        spec:              assets[0].spec              ?? null,
        serial_number:     assets[0].serial_number     ?? null,
        location:          assets[0].location          ?? original.location,
        remarks:           assets[0].remarks           ?? original.remarks,
        acquisition_date:  assets[0].acquisition_date,
      };
    } else {
      assetData = assets[0];
    }

    const created = await sequelize.transaction(async (t) => {
      const asset = await AssetEnterprise.create({
        ...assetData,
        responsible_type: 'personal',
        user_id:          userId,
        department_id:    assetData.department_id ?? null,
        state:            'in_use',
      }, { transaction: t });

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id:             userId,
        change_type:         'register',
        before_value:        null,
        after_value:         'in_use',
      }, { transaction: t });

      return asset;
    });

    return res.status(201).json({ message: '자산이 등록되었습니다.', asset: created });
  }

  // 일반 회원 → pending 요청 생성
  const requests = await AssetEnterpriseRequest.bulkCreate(
    assets.map((asset) => ({
      asset_id:          is_existing ? asset.asset_id : null,
      requester_id:      userId,
      status:            'pending',
      request_type:      'register',
      request_date:      new Date(),
      required_quantity: 1,
      request_reason:    asset.request_reason ?? null,
      new_asset_data:    JSON.stringify(is_existing
        ? {
            asset_number:      asset.asset_number      ?? null,
            manufacturer:      asset.manufacturer      ?? null,
            spec:              asset.spec              ?? null,
            serial_number:     asset.serial_number     ?? null,
            acquisition_date:  asset.acquisition_date,
            location:          asset.location          ?? null,
          }
        : {
            asset_number:      asset.asset_number,
            category_id:       asset.category_id,
            item_type_id:      asset.item_type_id,
            manufacturer:      asset.manufacturer,
            spec:              asset.spec              ?? null,
            serial_number:     asset.serial_number     ?? null,
            acquisition_date:  asset.acquisition_date,
            location:          asset.location          ?? null,
          }
      ),
    }))
  );

  res.status(201).json({
    message: '자산 등록 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    requests,
  });
});


// ─────────────────────────────────────────
// SW 자산 등록
// ─────────────────────────────────────────
exports.registerSw = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  let { is_existing, licenses } = req.body;

  if (licenses && !Array.isArray(licenses)) licenses = [licenses];
  if (!licenses || licenses.length === 0) {
    return res.status(400).json({ message: '등록할 SW 정보를 입력해주세요.' });
  }

  const maxCount = role === 'admin' ? 1 : 5;
  if (licenses.length > maxCount) {
    return res.status(400).json({ message: `최대 ${maxCount}개까지 등록할 수 있습니다.` });
  }

  for (const lic of licenses) {
    if (is_existing) {
      if (!lic.asset_sw_id) return res.status(400).json({ message: '기존 SW ID를 선택해주세요.' });
      const existingSw = await AssetSw.findByPk(lic.asset_sw_id);
      if (!existingSw) return res.status(404).json({ message: `ID ${lic.asset_sw_id}에 해당하는 SW가 없습니다.` });
    } else {
      if (!lic.name || !lic.manufacturer) {
        return res.status(400).json({ message: 'SW명, 제조사는 필수 입력 항목입니다.' });
      }
    }
    if (!lic.license_key || !lic.key_type) {
      return res.status(400).json({ message: '라이선스 키와 키 유형은 필수 입력 항목입니다.' });
    }
  }

  // 관리자 → 즉시 등록
  if (role === 'admin') {
    const lic = licenses[0];
    let swId = lic.asset_sw_id;

    const created = await sequelize.transaction(async (t) => {
      if (!is_existing) {
        const newSw = await AssetSw.create({
          name:             lic.name,
          version:          lic.version          ?? null,
          manufacturer:     lic.manufacturer,
          quantity:         lic.quantity         ?? 1,
          acquisition_date: lic.acquisition_date ?? null,
          state:            'available',
        }, { transaction: t });
        swId = newSw.id;
      }

      const license = await AssetSwLicense.create({
        asset_sw_id:      swId,
        user_id:          userId,
        license_key:      lic.license_key,
        license_password: lic.license_password  ?? null,
        key_type:         lic.key_type,
        related_link:     lic.related_link       ?? null,
        issue_date:       lic.issue_date         ?? null,
        remarks:          lic.remarks            ?? null,
        state:            'in_use',
      }, { transaction: t });

      await AssetSwHistory.create({
        asset_sw_id:  swId,
        license_id:   license.id,
        user_id:      userId,
        change_type:  'register',
        before_value: null,
        after_value:  'in_use',
      }, { transaction: t });

      return license;
    });

    return res.status(201).json({ message: 'SW 자산이 등록되었습니다.', license: created });
  }

  // 일반 회원 → pending 요청 생성
  const createdRequests = await AssetSwRequest.bulkCreate(
    licenses.map((lic) => ({
      asset_sw_id:       is_existing ? lic.asset_sw_id : null,
      requester_id:      userId,
      status:            'pending',
      request_type:      'register',
      request_date:      new Date(),
      required_quantity: 1,
      request_reason:    lic.request_reason ?? null,
      new_asset_data:    is_existing ? null : JSON.stringify({
        name:             lic.name,
        version:          lic.version          ?? null,
        manufacturer:     lic.manufacturer,
        quantity:         lic.quantity         ?? 1,
        acquisition_date: lic.acquisition_date ?? null,
        license_key:      lic.license_key,
        license_password: lic.license_password ?? null,
        key_type:         lic.key_type,
        related_link:     lic.related_link      ?? null,
      }),
    }))
  );

  res.status(201).json({
    message: 'SW 등록 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    requests: createdRequests,
  });
});


// ─────────────────────────────────────────
// DF 자산 등록 (admin / user 공통, 즉시 등록)
// ─────────────────────────────────────────
exports.registerDf = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { project_id, items } = req.body;

  if (!project_id || isNaN(Number(project_id))) {
    return res.status(400).json({ message: '프로젝트 ID를 입력해주세요.' });
  }

  const project = await AssetProject.findByPk(project_id);
  if (!project) return res.status(404).json({ message: '존재하지 않는 프로젝트입니다.' });

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: '등록할 자산 정보를 입력해주세요.' });
  }

  for (const item of items) {
    if (!item.asset_type_id) {
      return res.status(400).json({ message: '자산 종류를 선택해주세요.' });
    }
    if (!item.manufacturer || !item.model_name) {
      return res.status(400).json({ message: '제조사, 모델명은 필수 입력 항목입니다.' });
    }
    if (!item.acquisition_date) {
      return res.status(400).json({ message: '취득일은 필수 입력 항목입니다.' });
    }
  }

  const created = await sequelize.transaction(async (t) => {
    const lastItem = await AssetProjectItem.findOne({
      where: { project_id },
      order: [['item_number', 'DESC']],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    let nextItemNumber = lastItem ? lastItem.item_number + 1 : 1;

    const createdItems = await AssetProjectItem.bulkCreate(
      items.map((item) => ({
        project_id,
        user_id:            userId,
        item_number:        nextItemNumber++,
        asset_type_id:      item.asset_type_id,
        owner_organization: item.owner_organization ?? null,
        equipment_number:   item.equipment_number   ?? null,
        manufacturer:       item.manufacturer,
        model_name:         item.model_name,
        serial_number:      item.serial_number      ?? null,
        spec:               item.spec               ?? null,
        acquisition_date:   item.acquisition_date,
        return_date:        item.return_date         ?? null,
        state:              'in_use',
        location:           item.location            ?? null,
        remarks:            item.remarks             ?? null,
      })),
      { transaction: t }
    );

    await AssetProjectHistory.bulkCreate(
      createdItems.map((item) => ({
        asset_project_item_id: item.id,
        project_id,
        user_id:      userId,
        change_type:  'register',
        before_value: null,
        after_value:  'in_use',
      })),
      { transaction: t }
    );

    return createdItems;
  });

  res.status(201).json({
    message: `DF 자산 ${created.length}개가 등록되었습니다.`,
    items: created,
  });
});


// ─────────────────────────────────────────
// 자산 등록 요청 목록 조회
// ─────────────────────────────────────────
exports.getRequests = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const buildWhere = (extraWhere) => {
    if (role === 'admin') {
      return { status: 'pending', ...extraWhere };
    }
    return {
      requester_id: userId,
      [Op.or]: [
        { status: 'pending' },
        { status: { [Op.in]: ['approved', 'rejected'] }, updated_at: { [Op.gte]: cutoff } },
      ],
      ...extraWhere,
    };
  };

  const [enterpriseRequests, swRequests] = await Promise.all([
    AssetEnterpriseRequest.findAll({
      where: buildWhere(),
      include: [{ model: User, as: 'requester', attributes: ['id', 'email'] }],
      order: [['created_at', 'DESC']],
    }),
    AssetSwRequest.findAll({
      where: buildWhere(),
      include: [
        { model: User,    as: 'requester', attributes: ['id', 'email'] },
        { model: AssetSw, as: 'sw',        attributes: ['id', 'name', 'manufacturer'] },
      ],
      order: [['created_at', 'DESC']],
    }),
  ]);

  res.status(200).json({ enterprise: enterpriseRequests, sw: swRequests });
});


// ─────────────────────────────────────────
// 관리자 Enterprise 요청 승인
// ─────────────────────────────────────────
exports.approveEnterprise = asyncWrapper(async (req, res) => {
  const { role, userId } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 승인할 수 있습니다.' });

  const request = await AssetEnterpriseRequest.findByPk(requestId);
  if (!request)                      return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending')  return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  let assetData = {};
  if (request.asset_id) {
    const original = await AssetEnterprise.findByPk(request.asset_id);
    if (!original) return res.status(404).json({ message: '원본 자산을 찾을 수 없습니다.' });
    let overrides = {};
    try { overrides = JSON.parse(request.new_asset_data) ?? {}; } catch {}
    assetData = {
      category_id:       original.category_id,
      item_type_id:      original.item_type_id,
      asset_number:      overrides.asset_number      ?? original.asset_number,
      manufacturer:      overrides.manufacturer      ?? original.manufacturer,
      spec:              overrides.spec              ?? null,
      serial_number:     overrides.serial_number     ?? null,
      acquisition_date:  overrides.acquisition_date,
      location:          overrides.location          ?? null,
    };
  } else {
    if (!request.new_asset_data) return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    try {
      assetData = JSON.parse(request.new_asset_data);
    } catch {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }
  }

  const created = await sequelize.transaction(async (t) => {
    const asset = await AssetEnterprise.create({
      ...assetData,
      responsible_type: 'personal',
      user_id:          request.requester_id,
      department_id:    assetData.department_id ?? null,
      state:            'in_use',
    }, { transaction: t });

    await AssetEnterpriseHistory.create({
      asset_enterprise_id: asset.id,
      user_id:             userId,
      change_type:         'register',
      before_value:        null,
      after_value:         'in_use',
    }, { transaction: t });

    request.status       = 'approved';
    request.processed_at = new Date();
    await request.save({ transaction: t });

    return asset;
  });

  res.status(200).json({ message: '자산 등록 요청이 승인되었습니다.', asset: created });
});


// ─────────────────────────────────────────
// 관리자 Enterprise 요청 거절
// ─────────────────────────────────────────
exports.rejectEnterprise = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 처리할 수 있습니다.' });

  const request = await AssetEnterpriseRequest.findByPk(requestId);
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  request.status       = 'rejected';
  request.processed_at = new Date();
  await request.save();

  res.status(200).json({ message: '자산 등록 요청이 거절되었습니다.', request });
});


// ─────────────────────────────────────────
// 관리자 SW 요청 승인
// ─────────────────────────────────────────
exports.approveSw = asyncWrapper(async (req, res) => {
  const { role, userId } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 승인할 수 있습니다.' });

  const request = await AssetSwRequest.findByPk(requestId);
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  let swId = request.asset_sw_id;
  let swData = null;
  if (!swId) {
    if (!request.new_asset_data) return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    try { swData = JSON.parse(request.new_asset_data); }
    catch { return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' }); }
  }
  let licData = {};
  try { licData = JSON.parse(request.new_asset_data) ?? {}; } catch {}

  const { sw, license } = await sequelize.transaction(async (t) => {
    if (!swId) {
      const newSw = await AssetSw.create({
        name:             swData.name,
        version:          swData.version          ?? null,
        manufacturer:     swData.manufacturer,
        quantity:         swData.quantity         ?? 1,
        acquisition_date: swData.acquisition_date ?? null,
        state:            'available',
      }, { transaction: t });
      swId = newSw.id;
    }

    const createdLicense = await AssetSwLicense.create({
      asset_sw_id:      swId,
      user_id:          request.requester_id,
      license_key:      licData.license_key       ?? null,
      license_password: licData.license_password  ?? null,
      key_type:         licData.key_type           ?? null,
      related_link:     licData.related_link       ?? null,
      issue_date:       licData.issue_date         ?? null,
      remarks:          licData.remarks            ?? null,
      state:            'in_use',
    }, { transaction: t });

    await AssetSwHistory.create({
      asset_sw_id:  swId,
      license_id:   createdLicense.id,
      user_id:      userId,
      change_type:  'register',
      before_value: null,
      after_value:  'in_use',
    }, { transaction: t });

    request.status       = 'approved';
    request.processed_at = new Date();
    await request.save({ transaction: t });

    const createdSw = await AssetSw.findByPk(swId, { transaction: t });
    return { sw: createdSw, license: createdLicense };
  });

  res.status(200).json({
    message: 'SW 등록 요청이 승인되었습니다.',
    sw:      { id: sw.id, name: sw.name, manufacturer: sw.manufacturer, state: sw.state },
    license: { id: license.id, license_key: license.license_key, key_type: license.key_type },
    request: { id: request.id, status: request.status, processed_at: request.processed_at },
  });
});


// ─────────────────────────────────────────
// 관리자 SW 요청 거절
// ─────────────────────────────────────────
exports.rejectSw = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 처리할 수 있습니다.' });

  const request = await AssetSwRequest.findByPk(requestId);
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  request.status       = 'rejected';
  request.processed_at = new Date();
  await request.save();

  res.status(200).json({ message: 'SW 등록 요청이 거절되었습니다.', request });
});


// ─────────────────────────────────────────
// Enterprise 자산 반납
// - state → 'returned', responsible_type → 'vacant'
// - AssetEnterpriseHistory change_type: 'returned'
// ─────────────────────────────────────────
exports.returnEnterprise = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { asset_ids } = req.body;

  if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
    return res.status(400).json({ message: '반납할 자산을 선택해주세요.' });
  }

  const where = {
    id:    { [Op.in]: asset_ids },
    state: { [Op.ne]: 'returned' },
  };
  if (role !== 'admin') where.user_id = userId;

  const assets = await AssetEnterprise.findAll({ where });
  if (assets.length === 0)                      return res.status(404).json({ message: '반납할 수 있는 자산이 없습니다.' });
  if (assets.length !== asset_ids.length)       return res.status(400).json({ message: '반납할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id:             userId,
        change_type:         'returned',
        before_value:        asset.state,
        after_value:         'returned',
      }, { transaction: t });

      asset.state            = 'returned';
      asset.responsible_type = 'vacant';
      await asset.save({ transaction: t });
    }

    await AssetEnterpriseRequest.bulkCreate(
      assets.map((asset) => ({
        asset_id:          asset.id,
        requester_id:      userId,
        status:            'approved',
        request_type:      'return',
        request_date:      new Date(),
        required_quantity: 1,
        processed_at:      new Date(),
      })),
      { transaction: t }
    );
  });

  res.status(200).json({ message: `${assets.length}개의 자산이 반납되었습니다.` });
});


// ─────────────────────────────────────────
// SW 라이선스 반납
// - license.state: in_use → available
// - license.user_id → null
// - AssetSwHistory change_type: 'returned'
// ─────────────────────────────────────────
exports.returnSw = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { license_ids } = req.body;

  if (!license_ids || !Array.isArray(license_ids) || license_ids.length === 0) {
    return res.status(400).json({ message: '반납할 라이선스를 선택해주세요.' });
  }

  const where = {
    id:    { [Op.in]: license_ids },
    state: 'in_use',
  };
  if (role !== 'admin') where.user_id = userId;

  const licenses = await AssetSwLicense.findAll({ where });
  if (licenses.length === 0)                    return res.status(404).json({ message: '반납할 수 있는 라이선스가 없습니다.' });
  if (licenses.length !== license_ids.length)   return res.status(400).json({ message: '반납할 수 없는 라이선스가 포함되어 있습니다. (권한 없음 또는 이미 미사용 상태)' });

  await sequelize.transaction(async (t) => {
    for (const license of licenses) {
      await AssetSwHistory.create({
        asset_sw_id:  license.asset_sw_id,
        license_id:   license.id,
        user_id:      userId,
        change_type:  'returned',
        before_value: 'in_use',
        after_value:  'available',
      }, { transaction: t });

      license.state   = 'available';
      license.user_id = null;
      await license.save({ transaction: t });
    }

    await AssetSwRequest.bulkCreate(
      licenses.map((license) => ({
        asset_sw_id:       license.asset_sw_id,
        requester_id:      userId,
        status:            'approved',
        request_type:      'return',
        request_date:      new Date(),
        required_quantity: 1,
        processed_at:      new Date(),
      })),
      { transaction: t }
    );
  });

  res.status(200).json({ message: `${licenses.length}개의 라이선스가 반납되었습니다.` });
});


// ─────────────────────────────────────────
// DF 자산 반납
// - AssetProjectHistory change_type: 'returned'
// ─────────────────────────────────────────
exports.returnDf = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { item_ids } = req.body;

  if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ message: '반납할 자산을 선택해주세요.' });
  }

  const items = await AssetProjectItem.findAll({
    where: {
      id:    { [Op.in]: item_ids },
      state: { [Op.ne]: 'returned' },
    },
  });

  if (items.length === 0)                 return res.status(404).json({ message: '반납할 수 있는 자산이 없습니다.' });
  if (items.length !== item_ids.length)   return res.status(400).json({ message: '반납할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      await AssetProjectHistory.create({
        asset_project_item_id: item.id,
        project_id:            item.project_id,
        user_id:               userId,
        change_type:           'returned',
        before_value:          item.state,
        after_value:           'returned',
      }, { transaction: t });

      item.state = 'returned';
      await item.save({ transaction: t });
    }
  });

  res.status(200).json({ message: `${items.length}개의 자산이 반납되었습니다.` });
});


// ─────────────────────────────────────────
// Enterprise 자산 이동 (location 변경)
// - AssetEnterpriseHistory change_type: 'move'
// ─────────────────────────────────────────
exports.moveEnterprise = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { asset_ids, location } = req.body;

  if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
    return res.status(400).json({ message: '이동할 자산을 선택해주세요.' });
  }
  if (location === undefined || location === null) {
    return res.status(400).json({ message: '이동할 위치를 입력해주세요.' });
  }

  const where = {
    id:    { [Op.in]: asset_ids },
    state: { [Op.ne]: 'returned' },
  };
  if (role !== 'admin') where.user_id = userId;

  const assets = await AssetEnterprise.findAll({ where });
  if (assets.length === 0)                return res.status(404).json({ message: '이동할 수 있는 자산이 없습니다.' });
  if (assets.length !== asset_ids.length) return res.status(400).json({ message: '이동할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id:             userId,
        change_type:         'move',
        before_value:        asset.location ?? null,
        after_value:         location,
      }, { transaction: t });

      asset.location = location;
      await asset.save({ transaction: t });
    }
  });

  res.status(200).json({ message: `${assets.length}개의 자산 위치가 변경되었습니다.` });
});


// ─────────────────────────────────────────
// DF 자산 이동 (location 변경)
// - AssetProjectHistory change_type: 'move'
// ─────────────────────────────────────────
exports.moveDf = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { item_ids, location } = req.body;

  if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ message: '이동할 자산을 선택해주세요.' });
  }
  if (location === undefined || location === null) {
    return res.status(400).json({ message: '이동할 위치를 입력해주세요.' });
  }

  const items = await AssetProjectItem.findAll({
    where: {
      id:    { [Op.in]: item_ids },
      state: { [Op.ne]: 'returned' },
    },
  });

  if (items.length === 0)                 return res.status(404).json({ message: '이동할 수 있는 자산이 없습니다.' });
  if (items.length !== item_ids.length)   return res.status(400).json({ message: '이동할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      await AssetProjectHistory.create({
        asset_project_item_id: item.id,
        project_id:            item.project_id,
        user_id:               userId,
        change_type:           'move',
        before_value:          item.location ?? null,
        after_value:           location,
      }, { transaction: t });

      item.location = location;
      await item.save({ transaction: t });
    }
  });

  res.status(200).json({ message: `${items.length}개의 자산 위치가 변경되었습니다.` });
});

// ─────────────────────────────────────────
// 대시보드 (admin 전용)
// GET /assets/dashboard
// ─────────────────────────────────────────
exports.getDashboard = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  // ── SW 집계 ──────────────────────────────
  const swList = await AssetSw.findAll({
    where: { state: { [Op.ne]: 'returned' } },
    attributes: ['id', 'name', 'version', 'manufacturer', 'quantity', 'state'],
    include: [{
      model: AssetSwLicense,
      as: 'licenses',
      attributes: ['id', 'state', 'user_id'],
      include: [{ model: User, attributes: ['id', 'email'] }],
    }],
    order: [['name', 'ASC']],
  });

  const sw = swList.map((s) => {
    const inUseCount = s.licenses.filter(l => l.state === 'in_use').length;
    return {
      id:           s.id,
      name:         s.name,
      version:      s.version,
      manufacturer: s.manufacturer,
      quantity:     s.quantity,
      state:        s.state,
      in_use_count: inUseCount,
      available_count: s.quantity - inUseCount,
    };
  });

  const swTotal = {
    total_sw_count:      sw.length,
    total_license_count: sw.reduce((acc, s) => acc + s.quantity, 0),
    total_in_use:        sw.reduce((acc, s) => acc + s.in_use_count, 0),
    list: sw,
  };

  // ── Enterprise(PC) 집계 ──────────────────
  const enterpriseTypes = await AssetEnterpriseItemType.findAll({
    include: [{
      model: AssetEnterprise,
      as: 'assets',
      where: { state: { [Op.ne]: 'returned' } },
      attributes: ['id', 'state'],
      required: false,
    }],
    order: [['name', 'ASC']],
  });

  const enterpriseTotal = await AssetEnterprise.count({
    where: { state: { [Op.ne]: 'returned' } },
  });

  const enterprise = {
    total_count: enterpriseTotal,
    by_item_type: enterpriseTypes.map((t) => ({
      id:    t.id,
      code:  t.code,
      name:  t.name,
      count: t.assets ? t.assets.length : 0,
    })).filter(t => t.count > 0),
  };

  res.status(200).json({ sw: swTotal, enterprise });
});


// ─────────────────────────────────────────
// SW 전체 조회 (admin 전용)
// GET /assets/sw/list
// query: name, manufacturer, user_id
// ─────────────────────────────────────────
exports.getSwList = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { name, manufacturer, user_id } = req.query;

  const swWhere = { state: { [Op.ne]: 'returned' } };
  if (name)         swWhere.name         = { [Op.like]: `%${name}%` };
  if (manufacturer) swWhere.manufacturer = { [Op.like]: `%${manufacturer}%` };

  const licenseWhere = {};
  if (user_id) licenseWhere.user_id = Number(user_id);

  const swList = await AssetSw.findAll({
    where: swWhere,
    include: [{
      model: AssetSwLicense,
      as: 'licenses',
      where: Object.keys(licenseWhere).length > 0 ? licenseWhere : undefined,
      required: Object.keys(licenseWhere).length > 0,
      include: [{ model: User, attributes: ['id', 'email'] }],
    }],
    order: [['id', 'ASC']],
  });

  const result = swList.map((sw) => {
    const inUseCount = sw.licenses.filter(l => l.state === 'in_use').length;
    return {
      id:              sw.id,
      name:            sw.name,
      version:         sw.version,
      manufacturer:    sw.manufacturer,
      quantity:        sw.quantity,
      acquisition_date: sw.acquisition_date,
      state:           sw.state,
      remarks:         sw.remarks,
      in_use_count:    inUseCount,
      available_count: sw.quantity - inUseCount,
      created_at:      sw.created_at,
      updated_at:      sw.updated_at,
      licenses: sw.licenses.map(l => ({
        id:               l.id,
        license_key:      l.license_key,
        license_password: l.license_password,
        key_type:         l.key_type,
        related_link:     l.related_link,
        state:            l.state,
        issue_date:       l.issue_date,
        remarks:          l.remarks,
        user: l.User ? { id: l.User.id, email: l.User.email } : null,
      })),
    };
  });

  res.status(200).json({ total: result.length, list: result });
});


// ─────────────────────────────────────────
// Enterprise(PC) 전체 조회 (admin 전용)
// GET /assets/enterprise/list
// query: category_id, item_type_id, manufacturer, location,
//        state, user_id, department_id
// ─────────────────────────────────────────
exports.getEnterpriseList = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { category_id, item_type_id, manufacturer, location,
          state, user_id, department_id, keyword } = req.query;

  const where = { state: { [Op.ne]: 'returned' } };
  if (state)         where.state         = state;
  if (category_id)   where.category_id   = Number(category_id);
  if (item_type_id)  where.item_type_id  = Number(item_type_id);
  if (manufacturer)  where.manufacturer  = { [Op.like]: `%${manufacturer}%` };
  if (location)      where.location      = { [Op.like]: `%${location}%` };
  if (user_id)       where.user_id       = Number(user_id);
  if (department_id) where.department_id = Number(department_id);
  if (keyword) {
    where[Op.or] = [
      { asset_number:  { [Op.like]: `%${keyword}%` } },
      { manufacturer:  { [Op.like]: `%${keyword}%` } },
      { serial_number: { [Op.like]: `%${keyword}%` } },
      { spec:          { [Op.like]: `%${keyword}%` } },
      { location:      { [Op.like]: `%${keyword}%` } },
    ];
  }

  const list = await AssetEnterprise.findAll({
    where,
    include: [
      { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
      { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name', 'code'] },
      {
        model: User,
        attributes: ['id', 'email'],
        include: [{
          model: Profile,
          as: 'profile',
          attributes: ['name', 'department_id', 'company_rank'],
          include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
        }],
      },
    ],
    order: [['asset_number', 'ASC']],
  });

  res.status(200).json({ total: list.length, list });
});