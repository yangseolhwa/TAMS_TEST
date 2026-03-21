const { Op } = require('sequelize');

const sequelize = require('../config/db');
const asyncWrapper = require('../middleware/asyncWrapper');
const {
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType, AssetEnterpriseRequest,
  AssetSw, AssetSwLicense, AssetSwRequest,
  AssetProject, AssetProjectItem, AssetProjectItemType,
  User,
} = require('../models');

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────
const VALID_ENTERPRISE_STATES  = ['active', 'inactive', 'stored'];  // returned는 조회 필터에서 제외
const VALID_SW_STATES          = ['active', 'expiring', 'stored'];
const VALID_DF_STATES          = ['active', 'stored', 'rented'];
const VALID_SOFTWARE_TYPES     = ['dev', 'design', 'collaboration', 'security', 'other'];
const VALID_QUANTITY_UNITS     = ['ea', 'set', 'etc'];


// ─────────────────────────────────────────
// 개인 자산 조회 (enterprise + sw)
// ─────────────────────────────────────────
exports.getPersonalAssets = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { type, category_id, state, keyword, software_type } = req.query;

  // 필터 검증
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
  if (software_type && !VALID_SOFTWARE_TYPES.includes(software_type)) {
    return res.status(400).json({ message: '유효하지 않은 소프트웨어 유형입니다.' });
  }

  // enterprise 조회 (returned 제외)
  let enterprise = [];
  if (!type || type === 'enterprise') {
    const where = role === 'admin'
      ? { state: { [Op.ne]: 'returned' } }
      : { user_id: userId, state: { [Op.ne]: 'returned' } };
    if (category_id) where.category_id = Number(category_id);
    if (state)       where.state       = state;   // 명시적 state 필터는 덮어씀
    if (keyword) {
      where[Op.or] = [
        { asset_number:      { [Op.like]: `%${keyword}%` } },
        { manufacturer:      { [Op.like]: `%${keyword}%` } },
        { serial_number:     { [Op.like]: `%${keyword}%` } },
        { spec:              { [Op.like]: `%${keyword}%` } },
        { location:          { [Op.like]: `%${keyword}%` } },
        { responsible_value: { [Op.like]: `%${keyword}%` } },
      ];
    }
    enterprise = await AssetEnterprise.findAll({
      where,
      include: [
        { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
        { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name'] },
        { model: User,                                          attributes: ['id', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  // sw 조회 (returned 라이선스 제외)
  let sw = [];
  if (!type || type === 'sw') {
    const swWhere = {};
    if (state)         swWhere.state         = state;
    if (software_type) swWhere.software_type = software_type;
    if (keyword) {
      swWhere[Op.or] = [
        { name:         { [Op.like]: `%${keyword}%` } },
        { manufacturer: { [Op.like]: `%${keyword}%` } },
      ];
    }

    // returned 라이선스 제외 (state가 NULL인 경우도 포함)
    const licenseWhere = role === 'admin'
      ? { [Op.or]: [{ state: { [Op.ne]: 'returned' } }, { state: null }] }
      : { user_id: userId, [Op.or]: [{ state: { [Op.ne]: 'returned' } }, { state: null }] };

    sw = await AssetSw.findAll({
      where: swWhere,
      include: [{
        model: AssetSwLicense,
        as: 'licenses',
        where: licenseWhere,
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

  // 필터 검증
  if (state && !VALID_DF_STATES.includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다.' });
  }
  if (project_id && isNaN(Number(project_id))) {
    return res.status(400).json({ message: '유효하지 않은 프로젝트 ID입니다.' });
  }
  if (item_type_id && isNaN(Number(item_type_id))) {
    return res.status(400).json({ message: '유효하지 않은 자산 종류 ID입니다.' });
  }

  const projectWhere = project_id ? { id: Number(project_id) } : {};

  const itemWhere = { state: { [Op.ne]: 'returned' } };  // returned 기본 제외
  if (state)        itemWhere.state         = state;        // 명시적 필터는 덮어씀
  if (manufacturer) itemWhere.manufacturer  = { [Op.like]: `%${manufacturer}%` };
  if (item_type_id) itemWhere.asset_type_id = Number(item_type_id);
  if (keyword) {
    itemWhere[Op.or] = [
      { model_name:         { [Op.like]: `%${keyword}%` } },
      { serial_number:      { [Op.like]: `%${keyword}%` } },
      { spec:               { [Op.like]: `%${keyword}%` } },
      { location:           { [Op.like]: `%${keyword}%` } },
      { doosan_item_number: { [Op.like]: `%${keyword}%` } },
    ];
  }

  const hasItemFilter = true;  // state: { ne: returned } 가 항상 존재

  const projects = await AssetProject.findAll({
    where: projectWhere,
    include: [{
      model: AssetProjectItem,
      as: 'items',
      where: hasItemFilter ? itemWhere : undefined,
      required: hasItemFilter,
      include: [
        { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name', 'is_cable'] },
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

  // 필수 항목 검증
  for (const asset of assets) {
    if (is_existing) {
      if (!asset.asset_id) {
        return res.status(400).json({ message: '기존 자산 ID를 선택해주세요.' });
      }
      const existing = await AssetEnterprise.findByPk(asset.asset_id);
      if (!existing) {
        return res.status(404).json({ message: `ID ${asset.asset_id}에 해당하는 자산이 없습니다.` });
      }
    } else {
      if (!asset.asset_number || !asset.category_id || !asset.item_type_id || !asset.manufacturer || !asset.model_name) {
        return res.status(400).json({ message: '자산번호, 카테고리, 자산 종류, 제조사, 모델명은 필수 입력 항목입니다.' });
      }
    }
    if (!asset.acquisition_date) {
      return res.status(400).json({ message: '취득일은 필수 입력 항목입니다.' });
    }
    if (asset.required_quantity !== undefined && (isNaN(Number(asset.required_quantity)) || Number(asset.required_quantity) < 1)) {
      return res.status(400).json({ message: '수량은 1 이상이어야 합니다.' });
    }
  }

  // 관리자 → 즉시 active 등록 (1개)
  if (role === 'admin') {
    let assetData;
    if (is_existing) {
      const original = await AssetEnterprise.findByPk(assets[0].asset_id);
      assetData = {
        // FK는 원본 고정, 직접 입력 가능 필드는 요청값 우선 → 없으면 원본
        category_id:       original.category_id,
        item_type_id:      original.item_type_id,
        asset_number:      assets[0].asset_number      ?? original.asset_number,
        model_name:        assets[0].model_name        ?? original.model_name,
        manufacturer:      assets[0].manufacturer      ?? original.manufacturer,
        // nullable 필드는 원본 복사 없이 요청값만 사용 (없으면 null)
        spec:              assets[0].spec              ?? null,
        serial_number:     assets[0].serial_number     ?? null,
        responsible_value: assets[0].responsible_value ?? original.responsible_value,
        location:          assets[0].location          ?? original.location,
        remarks:           assets[0].remarks           ?? original.remarks,
        acquisition_date:  assets[0].acquisition_date,
      };
    } else {
      assetData = assets[0];
    }

    const created = await AssetEnterprise.create({
      ...assetData,
      responsible_type: 'admin',
      user_id: userId,
      state: 'active',
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
      required_quantity: asset.required_quantity ? Number(asset.required_quantity) : 1,
      request_reason:    asset.request_reason ?? null,
      new_asset_data:    JSON.stringify(is_existing
        // 기존 자산: FK는 원본에서 가져오므로 저장 불필요. override 가능 필드만 저장
        ? {
            asset_number:      asset.asset_number      ?? null,
            model_name:        asset.model_name        ?? null,
            manufacturer:      asset.manufacturer      ?? null,
            spec:              asset.spec              ?? null,
            serial_number:     asset.serial_number     ?? null,
            responsible_value: asset.responsible_value ?? null,
            acquisition_date:  asset.acquisition_date,
            location:          asset.location          ?? null,
          }
        // 신규 자산: 모든 필드 저장
        : {
            asset_number:      asset.asset_number,
            model_name:        asset.model_name,
            category_id:       asset.category_id,
            item_type_id:      asset.item_type_id,
            manufacturer:      asset.manufacturer,
            spec:              asset.spec              ?? null,
            serial_number:     asset.serial_number     ?? null,
            responsible_value: asset.responsible_value ?? null,
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

  // 필수 항목 검증
  for (const lic of licenses) {
    if (is_existing) {
      if (!lic.asset_sw_id) {
        return res.status(400).json({ message: '기존 SW ID를 선택해주세요.' });
      }
      const existingSw = await AssetSw.findByPk(lic.asset_sw_id);
      if (!existingSw) {
        return res.status(404).json({ message: `ID ${lic.asset_sw_id}에 해당하는 SW가 없습니다.` });
      }
    } else {
      if (!lic.name || !lic.software_type || !lic.manufacturer) {
        return res.status(400).json({ message: 'SW명, 소프트웨어 유형, 제조사는 필수 입력 항목입니다.' });
      }
    }
    if (!lic.license_key || !lic.key_type) {
      return res.status(400).json({ message: '라이선스 키와 키 유형은 필수 입력 항목입니다.' });
    }
  }

  // 관리자 → 즉시 active 등록 (1개)
  if (role === 'admin') {
    const lic = licenses[0];
    let swId = lic.asset_sw_id;

    if (!is_existing) {
      const newSw = await AssetSw.create({
        name:            lic.name,
        software_type:   lic.software_type,
        manufacturer:    lic.manufacturer,
        is_subscription: lic.is_subscription ?? false,
        state:           'active',
      });
      swId = newSw.id;
    }

    const created = await AssetSwLicense.create({
      asset_sw_id:       swId,
      user_id:           userId,
      subscription_date: lic.subscription_date  ?? null,
      license_key:       lic.license_key,
      license_password:  lic.license_password   ?? null,
      key_type:          lic.key_type,
      related_link:      lic.related_link        ?? null,
      state:             'active',
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
      request_reason:    lic.request_reason ?? null,           // user 메모
      new_asset_data:    is_existing ? null : JSON.stringify({ // 신규 SW 데이터만 별도 저장
        name:              lic.name,
        software_type:     lic.software_type,
        manufacturer:      lic.manufacturer,
        is_subscription:   lic.is_subscription   ?? false,
        license_key:       lic.license_key,
        license_password:  lic.license_password  ?? null,
        key_type:          lic.key_type,
        subscription_date: lic.subscription_date ?? null,
        related_link:      lic.related_link       ?? null,
      }),
    }))
  );

  res.status(201).json({
    message: 'SW 등록 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    requests: createdRequests,
  });
});


// ─────────────────────────────────────────
// DF 자산 등록 (admin / user 공통)
// ─────────────────────────────────────────
exports.registerDf = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { project_id, is_existing, items } = req.body;

  if (!project_id || isNaN(Number(project_id))) {
    return res.status(400).json({ message: '프로젝트 ID를 입력해주세요.' });
  }

  const project = await AssetProject.findByPk(project_id);
  if (!project) {
    return res.status(404).json({ message: '존재하지 않는 프로젝트입니다.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: '등록할 자산 정보를 입력해주세요.' });
  }

  // 필수 항목 검증
  for (const item of items) {
    if (!item.asset_type_id) {
      return res.status(400).json({ message: '자산 종류를 선택해주세요.' });
    }
    if (!is_existing && (!item.manufacturer || !item.model_name)) {
      return res.status(400).json({ message: '자산 종류, 제조사, 모델명은 필수 입력 항목입니다.' });
    }
    if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) < 1) {
      return res.status(400).json({ message: '수량은 1 이상이어야 합니다.' });
    }
    if (!item.rental_start_date) {
      return res.status(400).json({ message: '대여 시작일은 필수 입력 항목입니다.' });
    }
    if (item.quantity_unit && !VALID_QUANTITY_UNITS.includes(item.quantity_unit)) {
      return res.status(400).json({ message: '유효하지 않은 수량 단위입니다.' });
    }
  }

  // 기존 asset_type 존재 여부 확인 (is_existing일 때)
  if (is_existing) {
    for (const item of items) {
      const existingType = await AssetProjectItemType.findByPk(item.asset_type_id);
      if (!existingType) {
        return res.status(404).json({ message: `ID ${item.asset_type_id}에 해당하는 자산 종류가 없습니다.` });
      }
    }
  }

  // 트랜잭션 + 비관적 잠금으로 item_number 동시성 문제 해결
  const created = await sequelize.transaction(async (t) => {
    const lastItem = await AssetProjectItem.findOne({
      where: { project_id },
      order: [['item_number', 'DESC']],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    let nextItemNumber = lastItem ? lastItem.item_number + 1 : 1;

    return AssetProjectItem.bulkCreate(
      items.map((item) => ({
        project_id,
        user_id:            userId,
        item_number:        nextItemNumber++,
        asset_type_id:      item.asset_type_id,
        doosan_item_number: item.doosan_item_number ?? null,
        manufacturer:       item.manufacturer       ?? null,
        model_name:         item.model_name         ?? null,
        serial_number:      item.serial_number      ?? null,
        spec:               item.spec               ?? null,
        quantity:           Number(item.quantity),
        quantity_unit:      item.quantity_unit       ?? 'ea',
        rental_start_date:  item.rental_start_date,
        rental_end_date:    item.rental_end_date     ?? null,
        state:              'active',
        location:           item.location            ?? null,
        remarks:            item.remarks             ?? null,
      })),
      { transaction: t }
    );
  });

  res.status(201).json({
    message: `${is_existing ? '기존' : '신규'}DF 자산 ${created.length}개가 등록되었습니다.`,
    items: created,
  });
});


// ─────────────────────────────────────────
// 관리자 Enterprise 요청 승인
// ─────────────────────────────────────────
exports.approveEnterprise = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') {
    return res.status(403).json({ message: '관리자만 승인할 수 있습니다.' });
  }

  const request = await AssetEnterpriseRequest.findByPk(requestId);
  if (!request) {
    return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ message: '이미 처리된 요청입니다.' });
  }

  // 자산 정보 구성
  let assetData = {};
  if (request.asset_id) {
    // 기존 자산 기반: FK는 원본 고정, 나머지는 user override 우선 → 없으면 원본
    const original = await AssetEnterprise.findByPk(request.asset_id);
    if (!original) {
      return res.status(404).json({ message: '원본 자산을 찾을 수 없습니다.' });
    }
    let overrides = {};
    try { overrides = JSON.parse(request.new_asset_data) ?? {}; } catch {}

    assetData = {
      category_id:       original.category_id,
      item_type_id:      original.item_type_id,
      asset_number:      overrides.asset_number      ?? original.asset_number,
      model_name:        overrides.model_name        ?? original.model_name,
      manufacturer:      overrides.manufacturer      ?? original.manufacturer,
      // nullable 필드: user가 값을 입력했으면 사용, 아니면 null (원본 복사 안 함)
      spec:              overrides.spec              ?? null,
      serial_number:     overrides.serial_number     ?? null,
      responsible_value: overrides.responsible_value ?? null,
      acquisition_date:  overrides.acquisition_date,
      location:          overrides.location          ?? null,
    };
  } else {
    // 신규 자산: new_asset_data에서 전체 파싱
    if (!request.new_asset_data) {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }
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
      state:            'active',
    }, { transaction: t });

    request.status       = 'approved';
    request.processed_at = new Date();
    await request.save({ transaction: t });

    return asset;
  });

  res.status(200).json({ message: '자산 등록 요청이 승인되었습니다.', asset: created });
});


// ─────────────────────────────────────────
// 자산 등록 요청 목록 조회
// - user  : 본인 요청 전체 (approved/rejected는 24시간 지나면 미노출)
// - admin : 모든 user의 pending 요청만
// ─────────────────────────────────────────
exports.getRequests = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 현재 - 24시간

  // user/admin 공통 조건 빌더
  const buildWhere = (extraWhere) => {
    if (role === 'admin') {
      return { status: 'pending', ...extraWhere };
    }
    // user: 본인 요청이며, approved/rejected는 24시간 이내만 노출
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
        { model: AssetSw, as: 'sw', attributes: ['id', 'name', 'software_type', 'manufacturer'] },
      ],
      order: [['created_at', 'DESC']],
    }),
  ]);

  res.status(200).json({ enterprise: enterpriseRequests, sw: swRequests });
});


// ─────────────────────────────────────────
// 관리자 Enterprise 요청 거절
// ─────────────────────────────────────────
exports.rejectEnterprise = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;
  const { reject_reason } = req.body || {};

  if (role !== 'admin') {
    return res.status(403).json({ message: '관리자만 처리할 수 있습니다.' });
  }

  const request = await AssetEnterpriseRequest.findByPk(requestId);
  if (!request) {
    return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ message: '이미 처리된 요청입니다.' });
  }

  request.status       = 'rejected';
  request.admin_reason = reject_reason ?? null;
  request.processed_at = new Date();
  await request.save();

  res.status(200).json({ message: '자산 등록 요청이 거절되었습니다.', request });
});


// ─────────────────────────────────────────
// 관리자 SW 요청 거절
// ─────────────────────────────────────────
exports.rejectSw = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;
  const { reject_reason } = req.body || {};

  if (role !== 'admin') {
    return res.status(403).json({ message: '관리자만 처리할 수 있습니다.' });
  }

  const request = await AssetSwRequest.findByPk(requestId);
  if (!request) {
    return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ message: '이미 처리된 요청입니다.' });
  }

  request.status       = 'rejected';
  request.admin_reason = reject_reason ?? null;
  request.processed_at = new Date();
  await request.save();

  res.status(200).json({ message: 'SW 등록 요청이 거절되었습니다.', request });
});


// ─────────────────────────────────────────
// 관리자 SW 요청 승인
// ─────────────────────────────────────────
exports.approveSw = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') {
    return res.status(403).json({ message: '관리자만 승인할 수 있습니다.' });
  }

  const request = await AssetSwRequest.findByPk(requestId);
  if (!request) {
    return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ message: '이미 처리된 요청입니다.' });
  }

  let swId = request.asset_sw_id;

  // 신규 SW면 new_asset_data 미리 파싱 (트랜잭션 진입 전 검증)
  let swData = null;
  if (!swId) {
    if (!request.new_asset_data) {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }
    try {
      swData = JSON.parse(request.new_asset_data);
    } catch {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }
  }
  let licData = {};
  try { licData = JSON.parse(request.new_asset_data) ?? {}; } catch { /* 기존 SW 요청 */ }

  const { sw, license } = await sequelize.transaction(async (t) => {
    // 신규 SW 요청인 경우 → SW 마스터 데이터 생성
    if (!swId) {
      const newSw = await AssetSw.create({
        name:            swData.name,
        software_type:   swData.software_type,
        manufacturer:    swData.manufacturer,
        is_subscription: swData.is_subscription ?? false,
        state:           'active',
      }, { transaction: t });
      swId = newSw.id;
    }

    // 라이선스 생성
    const createdLicense = await AssetSwLicense.create({
      asset_sw_id:       swId,
      user_id:           request.requester_id,
      subscription_date: licData.subscription_date ?? null,
      license_key:       licData.license_key        ?? null,
      license_password:  licData.license_password   ?? null,
      key_type:          licData.key_type            ?? null,
      related_link:      licData.related_link        ?? null,
      state:             'active',
    }, { transaction: t });

    request.status       = 'approved';
    request.processed_at = new Date();
    await request.save({ transaction: t });

    const createdSw = await AssetSw.findByPk(swId, { transaction: t });
    return { sw: createdSw, license: createdLicense };
  });

  res.status(200).json({
    message: 'SW 등록 요청이 승인되었습니다.',
    sw: {
      id:              sw.id,
      name:            sw.name,
      software_type:   sw.software_type,
      manufacturer:    sw.manufacturer,
      is_subscription: sw.is_subscription,
      state:           sw.state,
    },
    license: {
      id:          license.id,
      license_key: license.license_key,
      key_type:    license.key_type,
    },
    request: {
      id:           request.id,
      status:       request.status,
      processed_at: request.processed_at,
    },
  });
});


// ─────────────────────────────────────────
// Enterprise 자산 반납
// - user/admin 모두 즉시 반납 처리
// - state → 'returned', responsible_type → 'admin'
// - 히스토리용 request 레코드 생성 (request_type: 'return', status: 'approved')
// ─────────────────────────────────────────
exports.returnEnterprise = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { asset_ids } = req.body;

  if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
    return res.status(400).json({ message: '반납할 자산을 선택해주세요.' });
  }

  // user는 본인 자산만, admin은 전체 가능 / 이미 반납된 자산 제외
  const where = {
    id:    { [Op.in]: asset_ids },
    state: { [Op.ne]: 'returned' },
  };
  if (role !== 'admin') where.user_id = userId;

  const assets = await AssetEnterprise.findAll({ where });

  if (assets.length === 0) {
    return res.status(404).json({ message: '반납할 수 있는 자산이 없습니다.' });
  }
  if (assets.length !== asset_ids.length) {
    return res.status(400).json({ message: '반납할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });
  }

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      asset.state            = 'returned';
      asset.responsible_type = 'admin';
      asset.return_date      = new Date();
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
// SW 자산 반납 (라이선스 단위)
// - license_ids 배열로 반납
// - AssetSwLicense.state → 'returned'
// - 히스토리용 request 레코드 생성
// ─────────────────────────────────────────
exports.returnSw = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { license_ids } = req.body;

  if (!license_ids || !Array.isArray(license_ids) || license_ids.length === 0) {
    return res.status(400).json({ message: '반납할 라이선스를 선택해주세요.' });
  }

  const where = {
    id:    { [Op.in]: license_ids },
    state: { [Op.ne]: 'returned' },
  };
  if (role !== 'admin') where.user_id = userId;

  const licenses = await AssetSwLicense.findAll({ where });

  if (licenses.length === 0) {
    return res.status(404).json({ message: '반납할 수 있는 라이선스가 없습니다.' });
  }
  if (licenses.length !== license_ids.length) {
    return res.status(400).json({ message: '반납할 수 없는 라이선스가 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });
  }

  await sequelize.transaction(async (t) => {
    for (const license of licenses) {
      license.state = 'returned';
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
// DF 자산 반납 (item 단위)
// - item_ids 배열로 반납
// - AssetProjectItem.state → 'returned'
// - AssetProjectHistory에 change_type: 'return' 기록
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

  if (items.length === 0) {
    return res.status(404).json({ message: '반납할 수 있는 자산이 없습니다.' });
  }
  if (items.length !== item_ids.length) {
    return res.status(400).json({ message: '반납할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });
  }

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      item.state = 'returned';
      await item.save({ transaction: t });
    }

    await AssetProjectHistory.bulkCreate(
      items.map((item) => ({
        asset_project_item_id: item.id,
        project_id:            item.project_id,
        change_by:             userId,
        change_type:           'return',
        state:                 'returned',
      })),
      { transaction: t }
    );
  });

  res.status(200).json({ message: `${items.length}개의 자산이 반납되었습니다.` });
});