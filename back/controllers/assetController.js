const { Op } = require('sequelize');
const sequelize = require('../config/db');
const asyncWrapper = require('../middleware/asyncWrapper');
const {
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseRequest, AssetEnterpriseHistory,
  AssetSw, AssetSwLicense, AssetSwRequest, AssetSwHistory,
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
  User, Department, Profile, AssetSwHistoryArchive, AssetEnterpriseHistoryArchive, AssetProjectHistoryArchive
} = require('../models');

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────
const VALID_ENTERPRISE_STATES = ['in_use', 'stored', 'returned'];
const VALID_SW_STATES         = ['in_use', 'available', 'returned'];
const VALID_DF_STATES         = ['in_use', 'stored', 'rented'];

/**
 * item_type 해결 헬퍼
 *  - item_type_id 있음 → 카테고리 일치 검증 후 id 반환
 *  - item_type_name만 있음 → 동일 카테고리 내 이름 검색:
 *      존재하면 id 반환 / 없으면 코드 자동배정 후 신규 생성
 */
async function resolveEnterpriseItemType(category_id, item_type_id, item_type_name, t) {
  const opts  = t ? { transaction: t } : {};
  const catId = Number(category_id);
 
  if (item_type_id) {
    const found = await AssetEnterpriseItemType.findOne({
      where: { id: Number(item_type_id), category_id: catId }, ...opts,
    });
    if (!found) {
      const err = new Error('선택한 카테고리에 존재하지 않는 자산 종류입니다.');
      err.statusCode = 400;
      throw err;
    }
    return found.id;
  }
 
  const trimmed = (item_type_name ?? '').trim();
  if (!trimmed) {
    const err = new Error('자산 종류를 선택하거나 직접 입력해주세요.');
    err.statusCode = 400;
    throw err;
  }
 
  // 동일 카테고리 + 동일 이름 우선 검색
  const existing = await AssetEnterpriseItemType.findOne({
    where: { category_id: catId, name: trimmed }, ...opts,
  });
  if (existing) return existing.id;
 
  // 신규 생성 — 다음 알파벳 코드 자동배정
  const allInCat = await AssetEnterpriseItemType.findAll({
    where: { category_id: catId }, attributes: ['code'], ...opts,
  });
  const used     = new Set(allInCat.map(r => (r.code ?? '').toUpperCase()));
  const nextCode = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(c => !used.has(c)) ?? `X${allInCat.length}`;
 
  const created = await AssetEnterpriseItemType.create(
    { category_id: catId, name: trimmed, code: nextCode }, opts,
  );
  return created.id;
}

const USER_INCLUDE = {
  model: User,
  attributes: ['id', 'email', 'role'],
  include: [{ model: Profile, as: 'profile', attributes: ['name']}]
};

// ─────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────

// 날짜 범위 WHERE 조건 생성 (Invalid Date 방어 포함)
function buildDateWhere(field, from, to) {
  const cond = {};
  const fromDate = from ? new Date(from) : null;
  const toDate   = to   ? new Date(to)   : null;
  if (fromDate && !isNaN(fromDate.getTime())) cond[Op.gte] = fromDate;
  if (toDate   && !isNaN(toDate.getTime()))   cond[Op.lte] = new Date(toDate.setHours(23, 59, 59, 999));
  return Object.keys(cond).length > 0 ? { [field]: cond } : {};
}

// YYYY-MM-DD 포맷 변환
function toDateStr(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// 공통 아카이빙 헬퍼 (배치 처리)
const ARCHIVE_BATCH_SIZE = 1000;

async function archiveHistory({ HistoryModel, ArchiveModel, where, mapFn, userId, archiveRange, t }) {
  let totalArchived = 0;

  while (true) {
    const batch = await HistoryModel.findAll({
      where,
      limit: ARCHIVE_BATCH_SIZE,
      transaction: t,
    });
    if (batch.length === 0) break;

    const now = new Date();
    await ArchiveModel.bulkCreate(
      batch.map((h) => ({
        ...mapFn(h),
        archived_at:   now,
        archived_by:   userId,
        archive_range: archiveRange,
      })),
      { transaction: t }
    );

    await HistoryModel.destroy({
      where: { id: { [Op.in]: batch.map((h) => h.id) } },
      transaction: t,
    });

    totalArchived += batch.length;
    if (batch.length < ARCHIVE_BATCH_SIZE) break;
  }

  return totalArchived;
}


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
        USER_INCLUDE,
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
        include: [USER_INCLUDE],
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
        { ...USER_INCLUDE, as: 'manager' },
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
 
  // ── 입력 유효성 검사 ────────────────────────────────────────────
  for (const asset of assets) {
    if (is_existing) {
      if (!asset.asset_id) return res.status(400).json({ message: '기존 자산 ID를 선택해주세요.' });
      const orig = await AssetEnterprise.findByPk(asset.asset_id);
      if (!orig) return res.status(404).json({ message: `ID ${asset.asset_id}에 해당하는 자산이 없습니다.` });
    } else {
      if (!asset.category_id) {
        return res.status(400).json({ message: '카테고리는 필수 입력 항목입니다.' });
      }
      if (!asset.item_type_id && !asset.item_type_name) {
        return res.status(400).json({ message: '자산 종류를 선택하거나 직접 입력해주세요.' });
      }
      if (!asset.manufacturer) {
        return res.status(400).json({ message: '제조사는 필수 입력 항목입니다.' });
      }
    }
    if (!asset.acquisition_date) {
      return res.status(400).json({ message: '취득일은 필수 입력 항목입니다.' });
    }
  }
 
  // ── 관리자 → 즉시 in_use 등록 ──────────────────────────────────
  if (role === 'admin') {
    const a = assets[0];
 
    const created = await sequelize.transaction(async (t) => {
      let finalCategoryId, finalItemTypeId, baseData;
 
      if (is_existing) {
        const original   = await AssetEnterprise.findByPk(a.asset_id, { transaction: t });
        finalCategoryId  = original.category_id;
        finalItemTypeId  = original.item_type_id;
        baseData = {
          manufacturer:     a.manufacturer     ?? original.manufacturer,
          spec:             a.spec             ?? null,
          serial_number:    a.serial_number    ?? null,
          location:         a.location         ?? original.location,
          remarks:          a.remarks          ?? original.remarks,
          acquisition_date: a.acquisition_date,
          department_id:    a.department_id    ?? null,
        };
      } else {
        finalCategoryId = Number(a.category_id);
        finalItemTypeId = await resolveEnterpriseItemType(
          finalCategoryId, a.item_type_id ?? null, a.item_type_name ?? null, t,
        );
        baseData = {
          manufacturer:     a.manufacturer,
          spec:             a.spec          ?? null,
          serial_number:    a.serial_number ?? null,
          location:         a.location      ?? null,
          remarks:          a.remarks       ?? null,
          acquisition_date: a.acquisition_date,
          department_id:    a.department_id ?? null,
        };
      }
 
      const asset = await AssetEnterprise.create({
        ...baseData,
        category_id:      finalCategoryId,
        item_type_id:     finalItemTypeId,
        responsible_type: 'personal',
        user_id:          userId,
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
 
  // ── 일반 회원 → pending 요청 생성 ──────────────────────────────
  // item_type_name → 요청 시점에 resolve (신규면 즉시 생성, id로 저장)
  const requestRows = [];
  for (const asset of assets) {
    let resolvedItemTypeId = null;
 
    if (!is_existing) {
      try {
        resolvedItemTypeId = await resolveEnterpriseItemType(
          Number(asset.category_id),
          asset.item_type_id  ?? null,
          asset.item_type_name ?? null,
          null,
        );
      } catch (e) {
        return res.status(e.statusCode ?? 400).json({ message: e.message });
      }
    }
 
    requestRows.push({
      asset_id:          is_existing ? asset.asset_id : null,
      requester_id:      userId,
      status:            'pending',
      request_type:      'register',
      request_date:      new Date(),
      required_quantity: 1,
      request_reason:    asset.request_reason ?? null,
      new_asset_data: JSON.stringify(
        is_existing
          ? {
              manufacturer:     asset.manufacturer  ?? null,
              spec:             asset.spec          ?? null,
              serial_number:    asset.serial_number ?? null,
              acquisition_date: asset.acquisition_date,
              location:         asset.location      ?? null,
              department_id:    asset.department_id ?? null,
            }
          : {
              category_id:      Number(asset.category_id),
              item_type_id:     resolvedItemTypeId,  // 항상 id로 저장
              manufacturer:     asset.manufacturer,
              spec:             asset.spec            ?? null,
              serial_number:    asset.serial_number   ?? null,
              acquisition_date: asset.acquisition_date,
              location:         asset.location        ?? null,
              department_id:    asset.department_id   ?? null,
            }
      ),
    });
  }
 
  const createdRequests = await AssetEnterpriseRequest.bulkCreate(requestRows);
  res.status(201).json({
    message: '자산 등록 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    requests: createdRequests,
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
          remarks:          lic.remarks          ?? null,
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
      new_asset_data: is_existing ? null : JSON.stringify({
        name:             lic.name,
        version:          lic.version          ?? null,
        manufacturer:     lic.manufacturer,
        quantity:         lic.quantity         ?? 1,
        acquisition_date: lic.acquisition_date ?? null,
        license_key:      lic.license_key,
        license_password: lic.license_password ?? null,
        key_type:         lic.key_type,
        related_link:     lic.related_link     ?? null,
        issue_date:       lic.issue_date       ?? null,
        remarks:          lic.remarks          ?? null,
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
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });
 
  let assetData = {};
 
  if (request.asset_id) {
    // is_existing 요청 — 원본 자산 + override 병합
    const original = await AssetEnterprise.findByPk(request.asset_id);
    if (!original) return res.status(404).json({ message: '원본 자산을 찾을 수 없습니다.' });
 
    let overrides = {};
    try { overrides = JSON.parse(request.new_asset_data) ?? {}; } catch {}
 
    assetData = {
      category_id:      original.category_id,
      item_type_id:     original.item_type_id,
      manufacturer:     overrides.manufacturer     ?? original.manufacturer,
      spec:             overrides.spec             ?? null,
      serial_number:    overrides.serial_number    ?? null,
      acquisition_date: overrides.acquisition_date,
      location:         overrides.location         ?? null,
      department_id:    overrides.department_id    ?? null,
    };
  } else {
    // 신규 등록 요청 — new_asset_data 사용 (item_type_id는 요청 시 이미 resolve됨)
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
        remarks:          swData.remarks          ?? null,
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
  const { license_ids, sw_ids } = req.body;
 
  const hasLicenses = Array.isArray(license_ids) && license_ids.length > 0;
  const hasSw       = Array.isArray(sw_ids)      && sw_ids.length > 0;
 
  if (!hasLicenses && !hasSw) {
    return res.status(400).json({ message: '반납할 라이선스 또는 SW를 선택해주세요.' });
  }
 
  // sw_ids는 admin 전용
  if (hasSw && role !== 'admin') {
    return res.status(403).json({ message: 'SW 직접 반납은 관리자만 할 수 있습니다.' });
  }
 
  // ── 사전 유효성 검증 (트랜잭션 외부) ────────────────────────────
  let licenses = [];
  let sws      = [];
 
  if (hasLicenses) {
    const licenseWhere = {
      id:    { [Op.in]: license_ids },
      state: 'in_use',
    };
    if (role !== 'admin') licenseWhere.user_id = userId;
 
    licenses = await AssetSwLicense.findAll({ where: licenseWhere });
 
    if (licenses.length === 0) {
      return res.status(404).json({ message: '반납할 수 있는 라이선스가 없습니다.' });
    }
    if (licenses.length !== license_ids.length) {
      return res.status(400).json({
        message: '반납할 수 없는 라이선스가 포함되어 있습니다. (권한 없음 또는 이미 미사용 상태)',
      });
    }
  }
 
  if (hasSw) {
    sws = await AssetSw.findAll({
      where: { id: { [Op.in]: sw_ids }, state: { [Op.ne]: 'returned' } },
    });
 
    if (sws.length === 0) {
      return res.status(404).json({ message: '반납할 수 있는 SW가 없습니다.' });
    }
    if (sws.length !== sw_ids.length) {
      return res.status(400).json({
        message: '반납할 수 없는 SW가 포함되어 있습니다. (이미 반납됨)',
      });
    }
 
    // 활성 라이선스 확인
    // — 동일 요청의 license_ids에 포함된 라이선스는 "반납 예정"으로 간주하여 제외
    for (const sw of sws) {
      const activeLicenseWhere = {
        asset_sw_id: sw.id,
        state:       'in_use',
      };
      if (hasLicenses) {
        activeLicenseWhere.id = { [Op.notIn]: license_ids };
      }
 
      const activeLicenseCount = await AssetSwLicense.count({ where: activeLicenseWhere });
      if (activeLicenseCount > 0) {
        return res.status(400).json({
          message: `'${sw.name}'에 사용 중인 라이선스가 있습니다. 라이선스를 먼저 반납하거나 동일 요청에 포함해주세요.`,
        });
      }
    }
  }
 
  // ── 트랜잭션 처리 ─────────────────────────────────────────────────
  let returnedLicenseCount = 0;
  let returnedSwCount      = 0;
 
  await sequelize.transaction(async (t) => {
 
    // ─ 라이선스 반납 ──────────────────────────────────────────────
    if (hasLicenses) {
      const affectedSwIds = new Set();
 
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
        affectedSwIds.add(license.asset_sw_id);
      }
      returnedLicenseCount = licenses.length;
 
      // 영향받은 SW 마스터 state 재계산
      // — sw_ids에도 포함된 SW는 어차피 returned로 처리되므로 건너뜀
      for (const swId of affectedSwIds) {
        if (hasSw && sw_ids.includes(swId)) continue;
 
        const inUseCount = await AssetSwLicense.count({
          where:       { asset_sw_id: swId, state: 'in_use' },
          transaction: t,
        });
        await AssetSw.update(
          { state: inUseCount > 0 ? 'in_use' : 'available' },
          { where: { id: swId, state: { [Op.ne]: 'returned' } }, transaction: t }
        );
      }
 
      // 반납 요청 기록
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
    }
 
    // ─ SW 직접 반납 (admin 전용) ──────────────────────────────────
    if (hasSw) {
      for (const sw of sws) {
        await AssetSwHistory.create({
          asset_sw_id:  sw.id,
          license_id:   null,           // SW 레벨 이벤트이므로 license 없음
          user_id:      userId,
          change_type:  'returned',
          before_value: sw.state,
          after_value:  'returned',
        }, { transaction: t });
 
        sw.state = 'returned';
        await sw.save({ transaction: t });
      }
      returnedSwCount = sws.length;
    }
  });
 
  // ── 응답 ──────────────────────────────────────────────────────────
  const parts = [];
  if (returnedLicenseCount > 0) parts.push(`라이선스 ${returnedLicenseCount}개`);
  if (returnedSwCount > 0)      parts.push(`SW ${returnedSwCount}개`);
 
  res.status(200).json({
    message:           `${parts.join(', ')}가 반납되었습니다.`,
    returned_licenses: returnedLicenseCount,
    returned_sw:       returnedSwCount,
  });
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
// DF 대시보드 (admin + user 공통)
// GET /assets/dashboard/df
// ─────────────────────────────────────────
exports.getDfDashboard = asyncWrapper(async (req, res) => {
  const items = await AssetProjectItem.findAll({
    where: { state: { [Op.ne]: 'returned' } },
    attributes: ['id', 'project_id', 'asset_type_id'],
    include: [
      { model: AssetProject,         as: 'project',   attributes: ['id', 'name'] },
      { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name'] },
    ],
  });

  // 프로젝트별 집계
  const projectMap = {};
  for (const item of items) {
    const pid  = item.project_id;
    const pname = item.project?.name ?? '미지정';
    if (!projectMap[pid]) {
      projectMap[pid] = { id: pid, name: pname, total_count: 0, by_type: {} };
    }
    projectMap[pid].total_count += 1;

    const tid   = item.asset_type_id;
    const tname = item.item_type?.name ?? '미분류';
    if (!projectMap[pid].by_type[tid]) {
      projectMap[pid].by_type[tid] = { type_id: tid, type_name: tname, count: 0 };
    }
    projectMap[pid].by_type[tid].count += 1;
  }

  const projects = Object.values(projectMap).map((p) => ({
    id:          p.id,
    name:        p.name,
    total_count: p.total_count,
    by_type:     Object.values(p.by_type).sort((a, b) => b.count - a.count),
  })).sort((a, b) => a.name.localeCompare(b.name));

  res.status(200).json({
    total: items.length,
    projects,
  });
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
      include: [USER_INCLUDE],
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
  const [enterpriseTotal, countRows, itemTypes] = await Promise.all([
    AssetEnterprise.count({
      where: { state: { [Op.ne]: 'returned' } },
    }),
    AssetEnterprise.findAll({
      where: { state: { [Op.ne]: 'returned' } },
      attributes: [
        'item_type_id',
        [sequelize.fn('COUNT', sequelize.col('AssetEnterprise.id')), 'count'],
      ],
      group: ['item_type_id'],
      raw: true,
    }),
    AssetEnterpriseItemType.findAll({
      attributes: ['id', 'code', 'name'],
      order: [['name', 'ASC']],
    }),
  ]);

  const countMap = Object.fromEntries(
    countRows.map((r) => [r.item_type_id, parseInt(r.count, 10)])
  );

  const enterprise = {
    total_count: enterpriseTotal,
    by_item_type: itemTypes
      .map((t) => ({ id: t.id, code: t.code, name: t.name, count: countMap[t.id] || 0 }))
      .filter((t) => t.count > 0),
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
      include: [USER_INCLUDE],
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
        user: l.User ? { id: l.User.id, email: l.User.email, role: l.User.role, name: l.User.profile?.name } : null,
      })),
    };
  });

  res.status(200).json({ total: result.length, list: result });
});

// ─────────────────────────────────────────
// SW 라이선스 할당 (admin 전용)
// PATCH /assets/sw/assign
// body: { license_id, user_id }
// ─────────────────────────────────────────
exports.assignSwLicense = asyncWrapper(async (req, res) => {
  const { role, userId: adminId } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { license_id, user_id } = req.body;

  if (!license_id) return res.status(400).json({ message: '라이선스 ID를 입력해주세요.' });
  if (!user_id)    return res.status(400).json({ message: '할당할 사용자 ID를 입력해주세요.' });

  const targetUser = await User.findByPk(user_id);
  if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  await sequelize.transaction(async (t) => {
    const license = await AssetSwLicense.findByPk(license_id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!license) return res.status(404).json({ message: '라이선스를 찾을 수 없습니다.' });
    if (license.state !== 'available') {
      return res.status(400).json({ message: '사용 가능한 상태의 라이선스만 할당할 수 있습니다.' });
    }

    const targetUser = await User.findByPk(user_id, { transaction: t });
    if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    await AssetSwHistory.create({
      asset_sw_id:  license.asset_sw_id,
      license_id:   license.id,
      user_id:      adminId,
      change_type:  'assign',
      before_value: 'available',
      after_value:  'in_use',
    }, { transaction: t });

    license.state   = 'in_use';
    license.user_id = user_id;
    await license.save({ transaction: t });

    res.status(200).json({ message: '라이선스가 할당되었습니다.', license_id, user_id });
  });
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
        attributes: ['id', 'email', 'role'],
        include: [{
          model: Profile,
          as: 'profile',
          attributes: ['name', 'department_id', 'company_rank'],
          include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
        }],
      },
    ],
    order: [['created_at', 'DESC']],
  });

  res.status(200).json({ total: list.length, list });
});

// ─────────────────────────────────────────
// 내자산 히스토리 조회 (SW + Enterprise)
// GET /assets/history/personal
// query: type(sw|enterprise), asset_sw_id, item_type_id, from, to
// ─────────────────────────────────────────
exports.getPersonalHistory = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { type, asset_sw_id, item_type_id, from, to } = req.query;

  let swHistory = [];
  let enterpriseHistory = [];

  // ── SW 히스토리 ──────────────────────────
  if (!type || type === 'sw') {
    const swWhere = { ...buildDateWhere('created_at', from, to)};
    if (role !== 'admin') swWhere.user_id = userId;

    const swInclude = [
      {
        model: AssetSw,
        as: 'sw',
        attributes: ['id', 'name', 'version', 'manufacturer'],
        ...(asset_sw_id ? { where: { id: Number(asset_sw_id) } } : {}),
        required: !!asset_sw_id,
      },
      { model: AssetSwLicense, as: 'license', attributes: ['id', 'license_key', 'key_type'] },
      { ...USER_INCLUDE, as: 'changedBy' },
    ];

    swHistory = await AssetSwHistory.findAll({
      where: swWhere,
      include: swInclude,
      order: [['created_at', 'DESC']],
    });
  }

  // ── Enterprise 히스토리 ──────────────────
  if (!type || type === 'enterprise') {
    const entWhere = { ...buildDateWhere('created_at', from, to) };
    if (role !== 'admin') entWhere.user_id = userId;

    const entInclude = [
      {
        model: AssetEnterprise,
        as: 'asset',
        attributes: ['id', 'asset_number', 'manufacturer', 'state'],
        ...(item_type_id ? { where: { item_type_id: Number(item_type_id) } } : {}),
        required: !!item_type_id,
        include: [
          { model: AssetEnterpriseItemType, as: 'item_type', attributes: ['id', 'name', 'code'] },
        ],
      },
      { ...USER_INCLUDE, as: 'changedBy' },
    ];

    enterpriseHistory = await AssetEnterpriseHistory.findAll({
      where: entWhere,
      include: entInclude,
      order: [['created_at', 'DESC']],
    });
  }

  res.status(200).json({
    sw:         swHistory,
    enterprise: enterpriseHistory,
  });
});


// ─────────────────────────────────────────
// DF 히스토리 조회
// GET /assets/history/df
// query: project_id, asset_type_id, from, to
// ─────────────────────────────────────────
exports.getDfHistory = asyncWrapper(async (req, res) => {
  const { project_id, asset_type_id, from, to } = req.query;

  const where = {};
  if (project_id) where.project_id = Number(project_id);
  Object.assign(where, buildDateWhere('created_at', from, to));

  const itemInclude = {
    model: AssetProjectItem,
    as: 'item',
    attributes: ['id', 'item_number', 'model_name', 'manufacturer', 'serial_number', 'state'],
    ...(asset_type_id ? { where: { asset_type_id: Number(asset_type_id) } } : {}),
    required: !!asset_type_id,
    include: [
      { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name'] },
    ],
  };

  const history = await AssetProjectHistory.findAll({
    where,
    include: [
      itemInclude,
      { model: AssetProject, as: 'project', attributes: ['id', 'name'] },
      { ...USER_INCLUDE, as: 'changedBy' },
    ],
    order: [['created_at', 'DESC']],
  });

  res.status(200).json({ total: history.length, list: history });
});


// ─────────────────────────────────────────
// SW 히스토리 아카이빙 (admin 전용)
// POST /assets/history/sw/archive
// body: { before?, after?, asset_sw_ids? }
// ─────────────────────────────────────────
exports.archiveSwHistory = asyncWrapper(async (req, res) => {
  const { role, userId } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { before, after, asset_sw_ids } = req.body;
  if (!before && !after && (!asset_sw_ids || asset_sw_ids.length === 0)) {
    return res.status(400).json({ message: 'before, after, asset_sw_ids 중 하나 이상 입력해주세요.' });
  }

  const where = {
    ...buildDateWhere('created_at', after, before),
    ...(asset_sw_ids?.length > 0 ? { asset_sw_id: { [Op.in]: asset_sw_ids } } : {}),
  };

  const afterStr  = toDateStr(after);
  const beforeStr = toDateStr(before);
  const archiveRange = [afterStr, beforeStr].filter(Boolean).join('~') || '전체';

  const archived = await sequelize.transaction(async (t) => {
    return archiveHistory({
      HistoryModel: AssetSwHistory,
      ArchiveModel: AssetSwHistoryArchive,
      where, userId, archiveRange, t,
      mapFn: (h) => ({
        history_id:   h.id,
        asset_sw_id:  h.asset_sw_id,
        license_id:   h.license_id,
        user_id:      h.user_id,
        change_type:  h.change_type,
        before_value: h.before_value,
        after_value:  h.after_value,
        created_at:   h.created_at,
      }),
    });
  });

  if (archived === 0) return res.status(200).json({ message: '아카이빙할 데이터가 없습니다.', archived: 0 });
  res.status(200).json({ message: `SW 히스토리 ${archived}건이 아카이빙되었습니다.`, archived, archive_range: archiveRange });
});


// ─────────────────────────────────────────
// Enterprise 히스토리 아카이빙 (admin 전용)
// POST /assets/history/enterprise/archive
// ─────────────────────────────────────────
exports.archiveEnterpriseHistory = asyncWrapper(async (req, res) => {
  const { role, userId } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { before, after, asset_enterprise_ids } = req.body;
  if (!before && !after && (!asset_enterprise_ids || asset_enterprise_ids.length === 0)) {
    return res.status(400).json({ message: 'before, after, asset_enterprise_ids 중 하나 이상 입력해주세요.' });
  }

  const where = {
    ...buildDateWhere('created_at', after, before),
    ...(asset_enterprise_ids?.length > 0 ? { asset_enterprise_id: { [Op.in]: asset_enterprise_ids } } : {}),
  };

  const afterStr  = toDateStr(after);
  const beforeStr = toDateStr(before);
  const archiveRange = [afterStr, beforeStr].filter(Boolean).join('~') || '전체';

  const archived = await sequelize.transaction(async (t) => {
    return archiveHistory({
      HistoryModel: AssetEnterpriseHistory,
      ArchiveModel: AssetEnterpriseHistoryArchive,
      where, userId, archiveRange, t,
      mapFn: (h) => ({
        history_id:          h.id,
        asset_enterprise_id: h.asset_enterprise_id,
        user_id:             h.user_id,
        change_type:         h.change_type,
        before_value:        h.before_value,
        after_value:         h.after_value,
        created_at:          h.created_at,
      }),
    });
  });

  if (archived === 0) return res.status(200).json({ message: '아카이빙할 데이터가 없습니다.', archived: 0 });
  res.status(200).json({ message: `Enterprise 히스토리 ${archived}건이 아카이빙되었습니다.`, archived, archive_range: archiveRange });
});


// ─────────────────────────────────────────
// DF 히스토리 아카이빙 (admin 전용)
// POST /assets/history/df/archive
// ─────────────────────────────────────────
exports.archiveDfHistory = asyncWrapper(async (req, res) => {
  const { role, userId } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { before, after, project_item_ids } = req.body;
  if (!before && !after && (!project_item_ids || project_item_ids.length === 0)) {
    return res.status(400).json({ message: 'before, after, project_item_ids 중 하나 이상 입력해주세요.' });
  }

  const where = {
    ...buildDateWhere('created_at', after, before),
    ...(project_item_ids?.length > 0 ? { asset_project_item_id: { [Op.in]: project_item_ids } } : {}),
  };

  const afterStr  = toDateStr(after);
  const beforeStr = toDateStr(before);
  const archiveRange = [afterStr, beforeStr].filter(Boolean).join('~') || '전체';

  const archived = await sequelize.transaction(async (t) => {
    return archiveHistory({
      HistoryModel: AssetProjectHistory,
      ArchiveModel: AssetProjectHistoryArchive,
      where, userId, archiveRange, t,
      mapFn: (h) => ({
        history_id:            h.id,
        asset_project_item_id: h.asset_project_item_id,
        project_id:            h.project_id,
        user_id:               h.user_id,
        change_type:           h.change_type,
        before_value:          h.before_value,
        after_value:           h.after_value,
        created_at:            h.created_at,
      }),
    });
  });

  if (archived === 0) return res.status(200).json({ message: '아카이빙할 데이터가 없습니다.', archived: 0 });
  res.status(200).json({ message: `DF 히스토리 ${archived}건이 아카이빙되었습니다.`, archived, archive_range: archiveRange });
});

// ─────────────────────────────────────────
// SW 히스토리 아카이브 조회 (admin 전용)
// GET /api/assets/history/sw/archive
// query: asset_sw_id, archive_range, from, to
// ─────────────────────────────────────────
exports.getSwHistoryArchive = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { asset_sw_id, archive_range, from, to } = req.query;

  const where = { ...buildDateWhere('archived_at', from, to) };
  if (asset_sw_id)   where.asset_sw_id   = Number(asset_sw_id);
  if (archive_range) where.archive_range = archive_range;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: list } = await AssetSwHistoryArchive.findAndCountAll({
    where,
    order: [['archived_at', 'DESC']],
    limit,
    offset,
  });

  res.status(200).json({ total: count, list });
});

// ─────────────────────────────────────────
// Enterprise 히스토리 아카이브 조회 (admin 전용)
// GET /api/assets/history/enterprise/archive
// query: asset_enterprise_id, archive_range, from, to
// ─────────────────────────────────────────
exports.getEnterpriseHistoryArchive = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { asset_enterprise_id, archive_range, from, to } = req.query;

  const where = { ...buildDateWhere('archived_at', from, to) };
  if (asset_enterprise_id) where.asset_enterprise_id = Number(asset_enterprise_id);
  if (archive_range)       where.archive_range       = archive_range;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: list } = await AssetEnterpriseHistoryArchive.findAndCountAll({
    where,
    order: [['archived_at', 'DESC']],
    limit,
    offset,
  });

  res.status(200).json({ total: count, list });
});

// ─────────────────────────────────────────
// DF 히스토리 아카이브 조회 (admin 전용)
// GET /api/assets/history/df/archive
// query: project_id, asset_project_item_id, archive_range, from, to
// ─────────────────────────────────────────
exports.getDfHistoryArchive = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { project_id, asset_project_item_id, archive_range, from, to } = req.query;

  const where = { ...buildDateWhere('archived_at', from, to) };
  if (project_id)            where.project_id            = Number(project_id);
  if (asset_project_item_id) where.asset_project_item_id = Number(asset_project_item_id);
  if (archive_range)         where.archive_range         = archive_range;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: list } = await AssetProjectHistoryArchive.findAndCountAll({
    where,
    order: [['archived_at', 'DESC']],
    limit,
    offset,
  });

  res.status(200).json({ total: count, list });
});

// ═════════════════════════════════════════════════════════════
// 자산 상태 변경 (DF / Enterprise / SW)
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// DF 자산 상태 변경
// PATCH /api/assets/df/state
// body: { item_ids: [1, 2], state: "stored" }
// 변경 가능 상태: in_use / stored / rented  (returned 제외 — 반납은 /df/return)
// ─────────────────────────────────────────
exports.changeDfState = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { item_ids, state } = req.body;

  if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ message: '상태를 변경할 자산을 선택해주세요.' });
  }
  if (!state || !VALID_DF_STATES.includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다. (in_use / stored / rented)' });
  }

  const items = await AssetProjectItem.findAll({
    where: {
      id:    { [Op.in]: item_ids },
      state: { [Op.ne]: 'returned' },
    },
  });

  if (items.length === 0) {
    return res.status(404).json({ message: '상태를 변경할 수 있는 자산이 없습니다.' });
  }
  if (items.length !== item_ids.length) {
    return res.status(400).json({ message: '변경할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });
  }

  let changedCount = 0;

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      if (item.state === state) continue;

      await AssetProjectHistory.create({
        asset_project_item_id: item.id,
        project_id:            item.project_id,
        user_id:               userId,
        change_type:           'change',
        before_value:          item.state,
        after_value:           state,
      }, { transaction: t });

      item.state = state;
      await item.save({ transaction: t });
      changedCount++;
    }
  });

  if (changedCount === 0) {
    return res.status(200).json({ message: '이미 해당 상태인 자산만 선택되었습니다.', changed: 0 });
  }
  res.status(200).json({
    message: `${changedCount}개의 자산 상태가 변경되었습니다.`,
    changed: changedCount,
  });
});


// ─────────────────────────────────────────
// Enterprise 자산 상태 변경
// PATCH /api/assets/enterprise/state
// body: { asset_ids: [1, 2], state: "stored" }
// 변경 가능 상태: in_use / stored  (returned 제외 — 반납은 /enterprise/return)
// admin: 전체 자산 / user: 본인 자산만
// ─────────────────────────────────────────
exports.changeEnterpriseState = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { asset_ids, state } = req.body;

  const CHANGEABLE_ENTERPRISE_STATES = ['in_use', 'stored'];

  if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
    return res.status(400).json({ message: '상태를 변경할 자산을 선택해주세요.' });
  }
  if (!state || !CHANGEABLE_ENTERPRISE_STATES.includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다. (in_use / stored)' });
  }

  const where = {
    id:    { [Op.in]: asset_ids },
    state: { [Op.ne]: 'returned' },
  };
  if (role !== 'admin') where.user_id = userId;

  const assets = await AssetEnterprise.findAll({ where });

  if (assets.length === 0) {
    return res.status(404).json({ message: '상태를 변경할 수 있는 자산이 없습니다.' });
  }
  if (assets.length !== asset_ids.length) {
    return res.status(400).json({ message: '변경할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });
  }

  let changedCount = 0;

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      if (asset.state === state) continue;

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id:             userId,
        change_type:         'change',
        before_value:        asset.state,
        after_value:         state,
      }, { transaction: t });

      asset.state = state;
      await asset.save({ transaction: t });
      changedCount++;
    }
  });

  if (changedCount === 0) {
    return res.status(200).json({ message: '이미 해당 상태인 자산만 선택되었습니다.', changed: 0 });
  }
  res.status(200).json({
    message: `${changedCount}개의 자산 상태가 변경되었습니다.`,
    changed: changedCount,
  });
});


// ─────────────────────────────────────────
// SW 라이선스 상태 변경 (admin 전용)
// PATCH /api/assets/sw/state
// body: { license_ids: [1, 2], state: "available" }
// 변경 가능 상태: in_use / available
// assign/return과 달리 user_id 유지, 히스토리 change_type: 'change'
// 변경 후 영향받은 asset_sw 마스터 state 자동 재계산
// ─────────────────────────────────────────
exports.changeSwState = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { license_ids, state } = req.body;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const CHANGEABLE_SW_LICENSE_STATES = ['in_use', 'available'];

  if (!license_ids || !Array.isArray(license_ids) || license_ids.length === 0) {
    return res.status(400).json({ message: '상태를 변경할 라이선스를 선택해주세요.' });
  }
  if (!state || !CHANGEABLE_SW_LICENSE_STATES.includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다. (in_use / available)' });
  }

  const licenses = await AssetSwLicense.findAll({
    where: { id: { [Op.in]: license_ids } },
  });

  if (licenses.length === 0) {
    return res.status(404).json({ message: '라이선스를 찾을 수 없습니다.' });
  }
  if (licenses.length !== license_ids.length) {
    return res.status(400).json({ message: '존재하지 않는 라이선스가 포함되어 있습니다.' });
  }

  let changedCount = 0;

  await sequelize.transaction(async (t) => {
    const affectedSwIds = new Set();

    for (const license of licenses) {
      if (license.state === state) continue;

      await AssetSwHistory.create({
        asset_sw_id:  license.asset_sw_id,
        license_id:   license.id,
        user_id:      userId,
        change_type:  'change',
        before_value: license.state,
        after_value:  state,
      }, { transaction: t });

      license.state = state;
      await license.save({ transaction: t });
      affectedSwIds.add(license.asset_sw_id);
      changedCount++;
    }

    // 영향받은 SW 마스터 state 재계산
    for (const swId of affectedSwIds) {
      const inUseCount = await AssetSwLicense.count({
        where: { asset_sw_id: swId, state: 'in_use' },
        transaction: t,
      });
      await AssetSw.update(
        { state: inUseCount > 0 ? 'in_use' : 'available' },
        { where: { id: swId }, transaction: t }
      );
    }
  });

  if (changedCount === 0) {
    return res.status(200).json({ message: '이미 해당 상태인 라이선스만 선택되었습니다.', changed: 0 });
  }
  res.status(200).json({
    message: `${changedCount}개의 라이선스 상태가 변경되었습니다.`,
    changed: changedCount,
  });
});
