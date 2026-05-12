const { Op } = require('sequelize');
const sequelize = require('../config/db');
const asyncWrapper = require('../middleware/asyncWrapper');
const { recalcSwState, recalcSwStateBatch } = require('../utils/swStateHelper');
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
const VALID_DF_QUERY_STATES   = ['in_use', 'stored', 'rented', 'returned'];

/**
 * item_type 해결 헬퍼
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

  const existing = await AssetEnterpriseItemType.findOne({
    where: { category_id: catId, name: trimmed }, ...opts,
  });
  if (existing) return existing.id;

  const allInCat = await AssetEnterpriseItemType.findAll({
    where: { category_id: catId }, attributes: ['code'], ...opts,
  });
  const used     = new Set(allInCat.map(r => (r.code ?? '').toUpperCase()));
  const nextAlpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(c => !used.has(c));

  let nextCode;
  if (nextAlpha) {
    nextCode = nextAlpha;
  } else {
    const existingXNums = allInCat
      .map(r => r.code)
      .filter(c => /^X\d+$/.test(c ?? ''))
      .map(c => parseInt(c.slice(1), 10));
    const maxX = existingXNums.length > 0 ? Math.max(...existingXNums) : -1;
    nextCode = `X${maxX + 1}`;
  }

  const created = await AssetEnterpriseItemType.create(
    { category_id: catId, name: trimmed, code: nextCode }, opts,
  );
  return created.id;
}

const USER_INCLUDE = {
  model: User,
  attributes: ['id', 'email', 'role'],
  include: [{ model: Profile, as: 'profile', attributes: ['name'] }]
};

function buildItemNumber(plain) {
  const cat  = plain.item_category?.name ?? null;
  const code = plain.item_type?.code     ?? null;
  return (cat && code && plain.id) ? `${cat}-${code}-${plain.id}` : null;
}

/**
 * responsible_type 기반 location 자동 결정
 *   personal → 해당 user의 Profile.name
 *   place    → 해당 asset의 Department.name (department_id 기준)
 */
async function resolveLocationByResponsible({ userId, departmentId, responsibleType }, t) {
  const opts = t ? { transaction: t } : {};

  if (responsibleType === 'personal' && userId) {
    const profile = await Profile.findOne({
      where:      { user_id: userId },
      attributes: ['name'],
      ...opts,
    });
    return profile?.name ?? null;
  }

  if (responsibleType === 'place' && departmentId) {
    const dept = await Department.findByPk(departmentId, { attributes: ['name'], ...opts });
    return dept?.name ?? null;
  }

  return null;
}

// ─────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────
function buildDateWhere(field, from, to) {
  const cond = {};
  const fromDate = from ? new Date(from) : null;
  const toDate   = to   ? new Date(to)   : null;
  if (fromDate && !isNaN(fromDate.getTime())) cond[Op.gte] = fromDate;
  if (toDate   && !isNaN(toDate.getTime()))   cond[Op.lte] = new Date(toDate.setHours(23, 59, 59, 999));
  return Object.keys(cond).length > 0 ? { [field]: cond } : {};
}

function toDateStr(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const ARCHIVE_BATCH_SIZE = 1000;

async function archiveHistory({ HistoryModel, ArchiveModel, where, mapFn, userId, archiveRange, t }) {
  let totalArchived = 0;
  while (true) {
    const batch = await HistoryModel.findAll({ where, limit: ARCHIVE_BATCH_SIZE, transaction: t });
    if (batch.length === 0) break;
    const now = new Date();
    await ArchiveModel.bulkCreate(
      batch.map((h) => ({ ...mapFn(h), archived_at: now, archived_by: userId, archive_range: archiveRange })),
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

  let enterprise = [];
  if (!type || type === 'enterprise') {
    const where = role === 'admin'
      ? { state: { [Op.ne]: 'returned' } }
      : { user_id: userId, state: { [Op.ne]: 'returned' } };
    if (category_id) where.category_id = Number(category_id);
    if (state)       where.state       = state;
    if (keyword) {
      where[Op.or] = [
        { manufacturer:  { [Op.like]: `%${keyword}%` } },
        { serial_number: { [Op.like]: `%${keyword}%` } },
        { spec:          { [Op.like]: `%${keyword}%` } },
        { location:      { [Op.like]: `%${keyword}%` } },
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

  res.status(200).json({
    enterprise: enterprise.map(e => {
      const p = e.toJSON();
      p.item_number = buildItemNumber(p);
      return p;
    }),
    sw,
  });
});


// ─────────────────────────────────────────
// DF 자산 조회
// ─────────────────────────────────────────
exports.getDfAssets = asyncWrapper(async (req, res) => {
  const { project_id, item_type_id, manufacturer, state, keyword } = req.query;

  if (state && !VALID_DF_QUERY_STATES.includes(state)) {
    return res.status(400).json({ message: '유효하지 않은 상태값입니다.' });
  }
  if (project_id   && isNaN(Number(project_id)))   return res.status(400).json({ message: '유효하지 않은 프로젝트 ID입니다.' });
  if (item_type_id && isNaN(Number(item_type_id))) return res.status(400).json({ message: '유효하지 않은 자산 종류 ID입니다.' });

  const projectWhere = project_id ? { id: Number(project_id) } : {};
  const itemWhere = {};
  if (state)        itemWhere.state         = state;
  if (manufacturer) itemWhere.manufacturer  = { [Op.like]: `%${manufacturer}%` };
  if (item_type_id) itemWhere.asset_type_id = Number(item_type_id);
  if (keyword) {
    itemWhere[Op.or] = [
      { model_number:       { [Op.like]: `%${keyword}%` } },
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
// DF 자산 종류 계층 조회
// ─────────────────────────────────────────
exports.getDfItemTypes = asyncWrapper(async (req, res) => {
  const parents = await AssetProjectItemType.findAll({
    where: { parent_id: null },
    attributes: ['id', 'name'],
    include: [{ model: AssetProjectItemType, as: 'children', attributes: ['id', 'name'] }],
    order: [['name', 'ASC'], [{ model: AssetProjectItemType, as: 'children' }, 'name', 'ASC']],
  });
  res.status(200).json({ types: parents });
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
      const orig = await AssetEnterprise.findByPk(asset.asset_id);
      if (!orig) return res.status(404).json({ message: `ID ${asset.asset_id}에 해당하는 자산이 없습니다.` });
    } else {
      if (!asset.category_id) return res.status(400).json({ message: '카테고리는 필수 입력 항목입니다.' });
      if (!asset.item_type_id && !asset.item_type_name) {
        return res.status(400).json({ message: '자산 종류를 선택하거나 직접 입력해주세요.' });
      }
      if (!asset.manufacturer) return res.status(400).json({ message: '제조사는 필수 입력 항목입니다.' });
    }
    if (!asset.acquisition_date) return res.status(400).json({ message: '취득일은 필수 입력 항목입니다.' });
  }

  if (role === 'admin') {
    const a = assets[0];
    const created = await sequelize.transaction(async (t) => {
      let finalCategoryId, finalItemTypeId, baseData;

      if (is_existing) {
        const original  = await AssetEnterprise.findByPk(a.asset_id, { transaction: t });
        finalCategoryId = original.category_id;
        finalItemTypeId = original.item_type_id;
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

      const autoLocation = await resolveLocationByResponsible(
        { userId, departmentId: a.department_id ?? null, responsibleType: 'personal' },
        t,
      );

      const asset = await AssetEnterprise.create({
        ...baseData,
        category_id:      finalCategoryId,
        item_type_id:     finalItemTypeId,
        responsible_type: 'personal',
        user_id:          userId,
        state:            'in_use',
        location:         autoLocation,
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

  const requestRows = [];
  for (const asset of assets) {
    let resolvedItemTypeId = null;
    if (!is_existing) {
      try {
        resolvedItemTypeId = await sequelize.transaction(async (t) => {
          return await resolveEnterpriseItemType(
            Number(asset.category_id),
            asset.item_type_id  ?? null,
            asset.item_type_name ?? null,
            t,
          );
        });
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
              item_type_id:     resolvedItemTypeId,
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
  await AssetEnterpriseHistory.bulkCreate(
    requestRows.map((row) => ({
      asset_enterprise_id: row.asset_id ?? null,
      user_id:             userId,
      change_type:         'request',
      before_value:        null,
      after_value:         'pending',
    }))
  );

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
  const {
    asset_sw_id, name, manufacturer, version, quantity, acquisition_date, remarks,
    related_link, license_required, add_quantity,
  } = req.body;

  let licenses = req.body.licenses ?? [];
  if (!Array.isArray(licenses)) licenses = [licenses];

  const isExisting = !!asset_sw_id;

  let existingSw = null;
  if (isExisting) {
    existingSw = await AssetSw.findByPk(asset_sw_id);
    if (!existingSw) return res.status(404).json({ message: `ID ${asset_sw_id}에 해당하는 SW가 없습니다.` });
    if (existingSw.state === 'returned') return res.status(400).json({ message: '반납된 SW입니다.' });

    if (!existingSw.license_required) {
      const qty = Number(add_quantity);
      if (!add_quantity || isNaN(qty) || qty < 1) {
        return res.status(400).json({ message: '추가할 수량을 1 이상 입력해주세요.' });
      }
    } else {
      if (licenses.length === 0) {
        return res.status(400).json({ message: '기존 SW에 추가할 라이선스를 입력해주세요.' });
      }
    }
  } else {
    if (!name || !manufacturer) {
      return res.status(400).json({ message: 'SW명, 제조사는 필수 입력 항목입니다.' });
    }
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty < 1) {
      const message = (license_required === false)
        ? '구독형 SW는 수량을 1 이상 입력해주세요.'
        : '라이선스형 SW는 총 라이선스 수량(capacity)을 1 이상 입력해주세요.';
      return res.status(400).json({ message });
    }
  }

  for (const lic of licenses) {
    if (!lic.license_key) return res.status(400).json({ message: '라이선스 키를 입력해주세요.' });
    if (!lic.key_type)    return res.status(400).json({ message: '라이선스 키 유형을 선택해주세요. (serial / credential)' });
    if (lic.license_type && !['per_seat', 'shared'].includes(lic.license_type)) {
      return res.status(400).json({ message: '유효하지 않은 라이선스 타입입니다. (per_seat / shared)' });
    }
  }

  const maxCount = role === 'admin' ? 1 : 5;
  if (licenses.length > maxCount) {
    return res.status(400).json({ message: `라이선스는 최대 ${maxCount}개까지 등록할 수 있습니다.` });
  }

  if (role === 'admin') {
    const result = await sequelize.transaction(async (t) => {
      let swId     = isExisting ? Number(asset_sw_id) : null;
      let targetSw = existingSw ?? null;

      if (!isExisting) {
        const isLicenseRequired = license_required !== false;
        targetSw = await AssetSw.create({
          name, manufacturer,
          version:          version          ?? null,
          quantity:         Number(quantity),
          acquisition_date: acquisition_date ?? null,
          license_required: isLicenseRequired,
          sw_type:          isLicenseRequired ? 'license' : 'subscription',
          related_link:     related_link     ?? null,
          remarks:          remarks          ?? null,
          state:            'available',
        }, { transaction: t });
        swId = targetSw.id;
      }

      if (isExisting && !targetSw.license_required) {
        const qty = Number(add_quantity);
        await targetSw.increment('quantity', { by: qty, transaction: t });
        await targetSw.reload({ transaction: t });
        await recalcSwState(swId, t);
        return { sw: targetSw, licenses: [] };
      }

      if (licenses.length > 0 && targetSw.quantity > 0) {
        const existingCount = await AssetSwLicense.count({ where: { asset_sw_id: swId }, transaction: t });
        if (existingCount + licenses.length > targetSw.quantity) {
          const err = new Error(`라이선스 수량 한도(${targetSw.quantity}개)를 초과합니다. 현재 ${existingCount}개 등록됨.`);
          err.statusCode = 400;
          throw err;
        }
      }

      const createdLicenses = [];
      for (const lic of licenses) {
        const license = await AssetSwLicense.create({
          asset_sw_id:      swId,
          user_id:          userId,
          user_note:        lic.user_note        ?? null,
          license_key:      lic.license_key,
          license_password: lic.license_password ?? null,
          key_type:         lic.key_type,
          license_type:     lic.license_type     ?? 'per_seat',
          issue_date:       lic.issue_date       ?? null,
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

        createdLicenses.push(license);
      }

      if (licenses.length > 0) await recalcSwState(swId, t);

      const sw = await AssetSw.findByPk(swId, { transaction: t });
      return { sw, licenses: createdLicenses };
    });

    const message = licenses.length === 0
      ? (isExisting ? '수량이 추가되었습니다.' : 'SW가 등록되었습니다.')
      : `SW 자산이 등록되었습니다. (라이선스 ${licenses.length}개)`;

    return res.status(201).json({ message, sw: result.sw, licenses: result.licenses });
  }

  const isLicenseRequired = isExisting ? existingSw.license_required : license_required !== false;
  let requestRows;

  if (!isLicenseRequired) {
    requestRows = [{
      asset_sw_id:       isExisting ? Number(asset_sw_id) : null,
      requester_id:      userId,
      status:            'pending',
      request_type:      'register',
      request_date:      new Date(),
      required_quantity: isExisting ? Number(add_quantity) : Number(quantity),
      request_reason:    req.body.request_reason ?? null,
      new_asset_data: JSON.stringify({
        ...(!isExisting ? { name, manufacturer, version: version ?? null, acquisition_date: acquisition_date ?? null, related_link: related_link ?? null, remarks: remarks ?? null, license_required: false } : {}),
        add_quantity: isExisting ? Number(add_quantity) : Number(quantity),
      }),
    }];
  } else if (licenses.length > 0) {
    requestRows = licenses.map((lic) => ({
      asset_sw_id:       isExisting ? Number(asset_sw_id) : null,
      requester_id:      userId,
      status:            'pending',
      request_type:      'register',
      request_date:      new Date(),
      required_quantity: 1,
      request_reason:    lic.request_reason ?? null,
      new_asset_data: JSON.stringify({
        ...(!isExisting ? { name, manufacturer, version: version ?? null, quantity: Number(quantity), acquisition_date: acquisition_date ?? null, related_link: related_link ?? null, remarks: remarks ?? null, license_required: true } : {}),
        license_key:      lic.license_key,
        license_password: lic.license_password ?? null,
        key_type:         lic.key_type,
        license_type:     lic.license_type    ?? 'per_seat',
        issue_date:       lic.issue_date      ?? null,
      }),
    }));
  } else {
    requestRows = [{
      asset_sw_id:       null,
      requester_id:      userId,
      status:            'pending',
      request_type:      'register',
      request_date:      new Date(),
      required_quantity: 1,
      request_reason:    req.body.request_reason ?? null,
      new_asset_data: JSON.stringify({ name, manufacturer, version: version ?? null, quantity: Number(quantity), acquisition_date: acquisition_date ?? null, related_link: related_link ?? null, remarks: remarks ?? null, license_required: true, license_key: null }),
    }];
  }

  const createdRequests = await AssetSwRequest.bulkCreate(requestRows);
  await AssetSwHistory.bulkCreate(
    requestRows.map((row) => ({
      asset_sw_id:  row.asset_sw_id ?? null,
      license_id:   null,
      user_id:      userId,
      change_type:  'request',
      before_value: null,
      after_value:  'pending',
    }))
  );

  res.status(201).json({
    message: 'SW 등록 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    requests: createdRequests,
  });
});


// ─────────────────────────────────────────
// DF 자산 등록
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
    const hasDirect = item.parent_type_id && item.sub_type_name?.trim();
    if (!item.asset_type_id && !hasDirect) {
      return res.status(400).json({ message: '자산 종류를 선택하거나 직접 입력해주세요.' });
    }
    if (!item.manufacturer || !item.model_number) {
      return res.status(400).json({ message: '제조사, 모델 번호는 필수 입력 항목입니다.' });
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

    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.asset_type_id) return { ...item, resolved_type_id: Number(item.asset_type_id) };
        const [child] = await AssetProjectItemType.findOrCreate({
          where:    { name: item.sub_type_name.trim(), parent_id: Number(item.parent_type_id) },
          defaults: { name: item.sub_type_name.trim(), parent_id: Number(item.parent_type_id) },
          transaction: t,
        });
        return { ...item, resolved_type_id: child.id };
      })
    );

    const createdItems = await AssetProjectItem.bulkCreate(
      resolvedItems.map((item) => ({
        project_id,
        user_id:            userId,
        item_number:        nextItemNumber++,
        asset_type_id:      item.resolved_type_id,
        owner_organization: item.owner_organization ?? null,
        equipment_number:   item.equipment_number   ?? null,
        manufacturer:       item.manufacturer       ?? null,
        product_name:       item.product_name       ?? null,
        model_number:       item.model_number       ?? null,
        serial_number:      item.serial_number      ?? null,
        quantity:           item.quantity           ?? null,
        spec:               item.spec               ?? null,
        acquisition_date:   item.acquisition_date,
        return_date:        item.return_date         ?? null,
        state:              item.return_date ? 'returned' : 'in_use',
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

  res.status(201).json({ message: `DF 자산 ${created.length}개가 등록되었습니다.`, items: created });
});


// ─────────────────────────────────────────
// 자산 등록 요청 목록 조회
// [Rev13] - 기존 SW/Enterprise 전체 정보 응답
//         - Enterprise N+1 → 배치 조회로 개선
// ─────────────────────────────────────────
exports.getRequests = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;

  const buildWhere = (extraWhere) => {
    if (role === 'admin') {
      return { status: 'pending', ...extraWhere };
    }
    return {
      requester_id: userId,
      [Op.or]: [
        { status: 'pending' },
        { status: { [Op.in]: ['approved', 'rejected'] } },
      ],
      ...extraWhere,
    };
  };

  const REQUESTER_INCLUDE = {
    model: User,
    as: 'requester',
    attributes: ['id', 'email'],
    include: [{ model: Profile, as: 'profile', attributes: ['name'] }],
  };

  // 라이선스 키/비밀번호는 admin만 노출
  const swLicenseAttrs = role === 'admin'
    ? ['id', 'license_key', 'license_password', 'key_type', 'license_type', 'state', 'user_id', 'user_note', 'issue_date']
    : ['id', 'key_type', 'license_type', 'state', 'user_id', 'user_note', 'issue_date'];

  const [enterpriseRequests, swRequests] = await Promise.all([
    AssetEnterpriseRequest.findAll({
      where: buildWhere(),
      include: [REQUESTER_INCLUDE],
      order: [['created_at', 'DESC']],
    }),
    AssetSwRequest.findAll({
      where: buildWhere(),
      include: [
        REQUESTER_INCLUDE,
        {
          model: AssetSw,
          as: 'sw',
          attributes: [
            'id', 'name', 'version', 'manufacturer', 'quantity',
            'acquisition_date', 'license_required', 'sw_type',
            'state', 'related_link', 'remarks',
          ],
          required: false,
          include: [{
            model: AssetSwLicense,
            as: 'licenses',
            attributes: swLicenseAttrs,
            include: [USER_INCLUDE],
            required: false,
          }],
        },
      ],
      order: [['created_at', 'DESC']],
    }),
  ]);

  // ── Enterprise 요청 보강 ──────────────────────────────────────────
  const categoryIds = new Set();
  const itemTypeIds = new Set();

  for (const r of enterpriseRequests) {
    if (r.request_type === 'register' && r.new_asset_data) {
      try {
        const d = JSON.parse(r.new_asset_data);
        if (d.category_id)  categoryIds.add(d.category_id);
        if (d.item_type_id) itemTypeIds.add(d.item_type_id);
      } catch {}
    }
  }

  // [N+1 수정] asset_ids 선수집 → 단일 findAll
  const assetIdsToFetch = [
    ...new Set(
      enterpriseRequests
        .filter(r => r.asset_id)
        .map(r => r.asset_id)
    ),
  ];

  const assetMap = {};
  if (assetIdsToFetch.length > 0) {
    const assets = await AssetEnterprise.findAll({
      where: { id: { [Op.in]: assetIdsToFetch } },
      attributes: [
        'id', 'state', 'responsible_type',
        'manufacturer', 'spec', 'serial_number',
        'location', 'acquisition_date', 'remarks',
      ],
      include: [
        { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
        { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name', 'code'] },
        {
          model: User,
          attributes: ['id', 'email', 'role'],
          include: [{ model: Profile, as: 'profile', attributes: ['name'] }],
        },
      ],
    });
    assets.forEach(a => {
      const j = a.toJSON();
      assetMap[a.id] = { ...j, item_number: buildItemNumber(j) };
    });
  }

  const [categories, itemTypes] = await Promise.all([
    categoryIds.size > 0
      ? AssetEnterpriseCategory.findAll({ where: { id: { [Op.in]: [...categoryIds] } }, attributes: ['id', 'name'] })
      : [],
    itemTypeIds.size > 0
      ? AssetEnterpriseItemType.findAll({ where: { id: { [Op.in]: [...itemTypeIds] } }, attributes: ['id', 'name', 'code'] })
      : [],
  ]);

  const catMap  = Object.fromEntries(categories.map(c => [c.id, c.toJSON()]));
  const typeMap = Object.fromEntries(itemTypes.map(t => [t.id, t.toJSON()]));

  // 루프 내 DB 쿼리 없음 — Map O(1) 참조
  const enterpriseResult = enterpriseRequests.map((r) => {
    const plain = r.toJSON();

    if (r.request_type === 'register' && plain.new_asset_data) {
      try {
        const d = JSON.parse(plain.new_asset_data);
        plain.category  = d.category_id  ? (catMap[d.category_id]  ?? null) : null;
        plain.item_type = d.item_type_id ? (typeMap[d.item_type_id] ?? null) : null;
      } catch {
        plain.category  = null;
        plain.item_type = null;
      }

      if (r.asset_id) {
        const assetJson    = assetMap[r.asset_id] ?? null;
        plain.category     = assetJson?.item_category ?? plain.category;
        plain.item_type    = assetJson?.item_type     ?? plain.item_type;
        plain.asset        = assetJson;
      } else {
        plain.asset = null;
      }
    }

    if (r.request_type === 'assign' && r.asset_id) {
      const assetJson  = assetMap[r.asset_id] ?? null;
      plain.category   = assetJson?.item_category ?? null;
      plain.item_type  = assetJson?.item_type     ?? null;
      plain.asset      = assetJson;
    }

    return plain;
  });

  // ── SW 요청 보강 ──────────────────────────────────────────────────
  const swResult = await Promise.all(
    swRequests.map(async (r) => {
      const plain = r.toJSON();

      if (r.request_type === 'assign' && r.new_asset_data) {
        try {
          const d = JSON.parse(r.new_asset_data);
          if (d.license_id) {
            const license = await AssetSwLicense.findByPk(d.license_id, {
              attributes: [
                'id',
                ...(role === 'admin' ? ['license_key', 'license_password'] : []),
                'key_type', 'license_type', 'state',
              ],
            });
            plain.license_detail = license ?? null;
          }
        } catch {
          plain.license_detail = null;
        }
      }

      return plain;
    })
  );

  res.status(200).json({ enterprise: enterpriseResult, sw: swResult });
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

  if (request.request_type === 'assign') {
    const asset = await sequelize.transaction(async (t) => {
      const lockedAsset = await AssetEnterprise.findByPk(request.asset_id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!lockedAsset) {
        const err = new Error('자산을 찾을 수 없습니다.'); err.statusCode = 404; throw err;
      }
      if (lockedAsset.state !== 'stored' || lockedAsset.responsible_type !== 'vacant') {
        const err = new Error('현재 할당할 수 없는 상태입니다. 자산 상태를 확인해주세요.'); err.statusCode = 409; throw err;
      }

      const autoLocation = await resolveLocationByResponsible(
        { userId: request.requester_id, departmentId: lockedAsset.department_id ?? null, responsibleType: 'personal' },
        t,
      );

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: lockedAsset.id, user_id: userId,
        change_type: 'assign', before_value: lockedAsset.state, after_value: 'in_use',
      }, { transaction: t });

      lockedAsset.state            = 'in_use';
      lockedAsset.responsible_type = 'personal';
      lockedAsset.user_id          = request.requester_id;
      lockedAsset.location         = autoLocation;
      await lockedAsset.save({ transaction: t });

      request.status       = 'approved';
      request.processed_at = new Date();
      await request.save({ transaction: t });

      return lockedAsset;
    });

    return res.status(200).json({
      message: '자산 할당 요청이 승인되었습니다.',
      asset:   { id: asset.id, state: asset.state, responsible_type: asset.responsible_type, user_id: asset.user_id },
      request: { id: request.id, status: request.status, processed_at: request.processed_at },
    });
  }

  if (request.request_type !== 'register') {
    return res.status(400).json({ message: `처리할 수 없는 요청 타입입니다: ${request.request_type}` });
  }

  let assetData = {};

  if (request.asset_id) {
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
    if (!request.new_asset_data) return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    try { assetData = JSON.parse(request.new_asset_data); } catch {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }
  }

  const created = await sequelize.transaction(async (t) => {
    const autoLocation = await resolveLocationByResponsible(
      { userId: request.requester_id, departmentId: assetData.department_id ?? null, responsibleType: 'personal' },
      t,
    );

    const asset = await AssetEnterprise.create({
      ...assetData,
      responsible_type: 'personal',
      user_id:          request.requester_id,
      department_id:    assetData.department_id ?? null,
      state:            'in_use',
      location:         autoLocation,
    }, { transaction: t });

    await AssetEnterpriseHistory.create({
      asset_enterprise_id: asset.id, user_id: request.requester_id,
      change_type: 'register', before_value: null, after_value: 'in_use',
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
  const { rejection_reason } = req.body;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 처리할 수 있습니다.' });

  const request = await AssetEnterpriseRequest.findByPk(requestId);
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  request.status           = 'rejected';
  request.rejection_reason = rejection_reason ?? null;
  request.processed_at     = new Date();
  await request.save();

  await AssetEnterpriseHistory.create({
    asset_enterprise_id: request.asset_id ?? null,
    user_id:             request.requester_id,
    change_type:         'rejected',
    before_value:        'pending',
    after_value:         'rejected',
  });

  res.status(200).json({ message: '자산 등록 요청이 거절되었습니다.', request });
});


// ─────────────────────────────────────────
// 관리자 SW 요청 승인
// [Fix] subscription_assign 블록 복구
// [Fix] 구독형 register 시 requester 라이선스 생성 복구
// [Fix] 수량 체크 버그 수정 (>= → >, 중복 쿼리 제거)
// ─────────────────────────────────────────
exports.approveSw = asyncWrapper(async (req, res) => {
  const { role, userId } = req.user;
  const { requestId } = req.params;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 승인할 수 있습니다.' });

  const request = await AssetSwRequest.findByPk(requestId);
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  // ── assign 요청 분기 ──────────────────────────────────────────────
  if (request.request_type === 'assign') {
    if (!request.new_asset_data) {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(request.new_asset_data) ?? {};
    } catch {
      return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
    }

    const { license_id, subscription_assign } = parsedData;

    // ── 구독형 할당 요청 승인 ─────────────────────────────────────────
    if (subscription_assign) {
      const { sw, license } = await sequelize.transaction(async (t) => {
        const lockedSw = await AssetSw.findByPk(request.asset_sw_id, { lock: t.LOCK.UPDATE, transaction: t });
        if (!lockedSw) {
          const err = new Error('SW를 찾을 수 없습니다.'); err.statusCode = 404; throw err;
        }
        if (lockedSw.license_required) {
          const err = new Error('라이선스형 SW입니다. 요청 데이터를 확인해주세요.'); err.statusCode = 400; throw err;
        }

        if (lockedSw.quantity > 0) {
          const inUseCount = await AssetSwLicense.count({
            where: { asset_sw_id: lockedSw.id, state: 'in_use' }, transaction: t,
          });
          if (inUseCount >= lockedSw.quantity) {
            const err = new Error(`할당 가능 수량(${lockedSw.quantity}개)을 초과했습니다.`); err.statusCode = 400; throw err;
          }
        }

        const newLicense = await AssetSwLicense.create({
          asset_sw_id:      lockedSw.id,
          user_id:          request.requester_id,
          user_note:        null, license_key: null, license_password: null,
          key_type:         null, license_type: 'per_seat', issue_date: null, state: 'in_use',
        }, { transaction: t });

        await AssetSwHistory.create({
          asset_sw_id: lockedSw.id, license_id: newLicense.id, user_id: userId,
          change_type: 'assign', before_value: null, after_value: 'in_use',
        }, { transaction: t });

        await recalcSwState(lockedSw.id, t);

        request.status       = 'approved';
        request.processed_at = new Date();
        await request.save({ transaction: t });

        const updatedSw = await AssetSw.findByPk(lockedSw.id, { transaction: t });
        return { sw: updatedSw, license: newLicense };
      });

      return res.status(200).json({
        message: '구독형 SW 할당 요청이 승인되었습니다.',
        sw:      { id: sw.id, name: sw.name, manufacturer: sw.manufacturer, state: sw.state },
        license: { id: license.id },
        request: { id: request.id, status: request.status, processed_at: request.processed_at },
      });
    }

    // ── 라이선스형 할당 요청 승인 ─────────────────────────────────────
    if (!license_id) return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });

    const { sw, license } = await sequelize.transaction(async (t) => {
      const lockedLicense = await AssetSwLicense.findByPk(license_id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!lockedLicense) {
        const err = new Error('라이선스를 찾을 수 없습니다.'); err.statusCode = 404; throw err;
      }
      if (lockedLicense.state !== 'available') {
        const err = new Error('이미 사용 중인 라이선스입니다. 다시 확인해주세요.'); err.statusCode = 409; throw err;
      }

      await AssetSwHistory.create({
        asset_sw_id: lockedLicense.asset_sw_id, license_id: lockedLicense.id, user_id: userId,
        change_type: 'assign', before_value: 'available', after_value: 'in_use',
      }, { transaction: t });

      lockedLicense.state   = 'in_use';
      lockedLicense.user_id = request.requester_id;
      await lockedLicense.save({ transaction: t });

      await recalcSwState(lockedLicense.asset_sw_id, t);

      request.status       = 'approved';
      request.processed_at = new Date();
      await request.save({ transaction: t });

      const updatedSw = await AssetSw.findByPk(lockedLicense.asset_sw_id, { transaction: t });
      return { sw: updatedSw, license: lockedLicense };
    });

    return res.status(200).json({
      message: '라이선스 할당 요청이 승인되었습니다.',
      sw:      { id: sw.id, name: sw.name, manufacturer: sw.manufacturer, state: sw.state },
      license: { id: license.id, license_key: license.license_key, key_type: license.key_type },
      request: { id: request.id, status: request.status, processed_at: request.processed_at },
    });
  }

  // ── register 요청 분기 ────────────────────────────────────────────
  if (request.request_type !== 'register') {
    return res.status(400).json({ message: `처리할 수 없는 요청 타입입니다: ${request.request_type}` });
  }

  if (!request.new_asset_data) {
    return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
  }

  let parsedData = {};
  try {
    parsedData = JSON.parse(request.new_asset_data) ?? {};
  } catch {
    return res.status(400).json({ message: '요청 데이터가 올바르지 않습니다.' });
  }

  const { sw, license } = await sequelize.transaction(async (t) => {
    let swId = request.asset_sw_id ?? null;

    if (!swId) {
      const isLicenseRequired = parsedData.license_required !== false;
      const newSw = await AssetSw.create({
        name:             parsedData.name,
        manufacturer:     parsedData.manufacturer,
        version:          parsedData.version          ?? null,
        quantity:         isLicenseRequired ? (parsedData.quantity ?? 0) : 0,
        acquisition_date: parsedData.acquisition_date ?? null,
        license_required: isLicenseRequired,
        sw_type:          isLicenseRequired ? 'license' : 'subscription',
        related_link:     parsedData.related_link     ?? null,
        remarks:          parsedData.remarks          ?? null,
        state:            'available',
      }, { transaction: t });
      swId = newSw.id;
    }

    const targetSw = await AssetSw.findByPk(swId, { transaction: t });

    // ── 구독형: 수량 추가 + requester에게 라이선스 생성 ──────────────
    if (!targetSw.license_required) {
      const qty = parsedData.add_quantity ?? request.required_quantity ?? 0;
      if (qty > 0) {
        await targetSw.increment('quantity', { by: qty, transaction: t });
      }
      await targetSw.reload({ transaction: t });

      // requester에게 구독 자리 생성
      const subLicense = await AssetSwLicense.create({
        asset_sw_id:      targetSw.id,
        user_id:          request.requester_id,
        user_note:        null, license_key: null, license_password: null,
        key_type:         null, license_type: 'per_seat', issue_date: null, state: 'in_use',
      }, { transaction: t });

      await AssetSwHistory.create({
        asset_sw_id:  targetSw.id, license_id: subLicense.id,
        user_id:      request.requester_id, change_type: 'register',
        before_value: null, after_value: 'in_use',
      }, { transaction: t });

      await recalcSwState(targetSw.id, t);

      request.status       = 'approved';
      request.processed_at = new Date();
      await request.save({ transaction: t });

      const updatedSw = await AssetSw.findByPk(targetSw.id, { transaction: t });
      return { sw: updatedSw, license: subLicense };
    }

    // 라이선스 없는 SW 요청
    if (!parsedData.license_key) {
      request.status       = 'approved';
      request.processed_at = new Date();
      await request.save({ transaction: t });
      return { sw: targetSw, license: null };
    }

    // ── 수량 한도 체크 (create 이후이므로 > 사용) ─────────────────────
    // [Fix] targetSw 재사용 (중복 findByPk 제거), >= → >
    if (targetSw.quantity > 0) {
      const existingCount = await AssetSwLicense.count({ where: { asset_sw_id: swId }, transaction: t });
      if (existingCount > targetSw.quantity) {
        const err = new Error(`라이선스 수량 한도(${targetSw.quantity}개)를 초과하여 승인할 수 없습니다.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 라이선스 생성
    const createdLicense = await AssetSwLicense.create({
      asset_sw_id:      swId,
      user_id:          request.requester_id,
      user_note:        parsedData.user_note        ?? null,
      license_key:      parsedData.license_key,
      license_password: parsedData.license_password ?? null,
      key_type:         parsedData.key_type,
      license_type:     parsedData.license_type    ?? 'per_seat',
      issue_date:       parsedData.issue_date      ?? null,
      state:            'in_use',
    }, { transaction: t });

    await AssetSwHistory.create({
      asset_sw_id:  swId, license_id: createdLicense.id,
      user_id:      request.requester_id, change_type: 'register',
      before_value: null, after_value: 'in_use',
    }, { transaction: t });

    if (targetSw && targetSw.quantity > 0) {
      const existingCount = await AssetSwLicense.count({
        where: { asset_sw_id: swId }, transaction: t,
      });
      if (existingCount > targetSw.quantity) {
        const err = new Error(
          `라이선스 수량 한도(${targetSw.quantity}개)를 초과하여 승인할 수 없습니다.`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    await recalcSwState(swId, t);

    request.status       = 'approved';
    request.processed_at = new Date();
    await request.save({ transaction: t });

    const createdSw = await AssetSw.findByPk(swId, { transaction: t });
    return { sw: createdSw, license: createdLicense };
  });

  res.status(200).json({
    message: '등록 요청이 승인되었습니다.',
    sw:      { id: sw.id, name: sw.name, manufacturer: sw.manufacturer, state: sw.state, quantity: sw.quantity },
    license: license
      ? { id: license.id, license_key: license.license_key, key_type: license.key_type, license_type: license.license_type }
      : null,
    request: { id: request.id, status: request.status, processed_at: request.processed_at },
  });
});


// ─────────────────────────────────────────
// 관리자 SW 요청 거절
// ─────────────────────────────────────────
exports.rejectSw = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  const { requestId } = req.params;
  const { rejection_reason } = req.body;

  if (role !== 'admin') return res.status(403).json({ message: '관리자만 처리할 수 있습니다.' });

  const request = await AssetSwRequest.findByPk(requestId);
  if (!request)                     return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
  if (request.status !== 'pending') return res.status(400).json({ message: '이미 처리된 요청입니다.' });

  request.status           = 'rejected';
  request.rejection_reason = rejection_reason ?? null;
  request.processed_at     = new Date();
  await request.save();

  await AssetSwHistory.create({
    asset_sw_id:  request.asset_sw_id ?? null,
    license_id:   null,
    user_id:      request.requester_id,
    change_type:  'rejected',
    before_value: 'pending',
    after_value:  'rejected',
  });

  res.status(200).json({ message: 'SW 등록 요청이 거절되었습니다.', request });
});


// ─────────────────────────────────────────
// Enterprise 자산 반납
// [Rev13] 3단계 반납 시나리오
//   1. 유저 보유 → stored + vacant + user_id=첫번째 admin
//   2. admin 보유 → stored + vacant + user_id=null
//   3. stored+vacant+null → returned (최종 폐기)
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
  if (assets.length === 0)
    return res.status(404).json({ message: '반납할 수 있는 자산이 없습니다.' });
  if (assets.length !== asset_ids.length)
    return res.status(400).json({ message: '반납할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });

  // 현재 담당자 역할 일괄 조회 (시나리오 1/2 분기용)
  const holderIds = [...new Set(assets.map(a => a.user_id).filter(Boolean))];
  const holderRoleMap = {};
  if (holderIds.length > 0) {
    const holderUsers = await User.findAll({
      where: { id: { [Op.in]: holderIds } }, attributes: ['id', 'role'],
    });
    holderUsers.forEach(u => { holderRoleMap[u.id] = u.role; });
  }

  // 시나리오 1용: 첫 번째 admin
  const firstAdmin = await User.findOne({
    where: { role: 'admin' }, order: [['id', 'ASC']], attributes: ['id'],
  });

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      let newState, newUserId, afterValue;

      if (
        asset.state            === 'stored' &&
        asset.responsible_type === 'vacant' &&
        asset.user_id          === null
      ) {
        // 시나리오 3: 최종 폐기
        newState   = 'returned';
        newUserId  = null;
        afterValue = 'returned';
      } else {
        const holderRole = asset.user_id
          ? (holderRoleMap[asset.user_id] ?? 'user')
          : 'user';

        if (holderRole === 'admin') {
          // 시나리오 2: admin 보유 자산 → 관리자 해제
          newState   = 'stored';
          newUserId  = null;
          afterValue = 'stored';
        } else {
          // 시나리오 1: 유저 보유 자산 → 첫번째 admin 인수
          newState   = 'stored';
          newUserId  = firstAdmin?.id ?? null;
          afterValue = 'stored';
        }
      }

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id:             userId,
        change_type:         'returned',
        before_value:        asset.state,
        after_value:         afterValue,
      }, { transaction: t });

      asset.state            = newState;
      asset.responsible_type = 'vacant';
      asset.user_id          = newUserId;
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
// ─────────────────────────────────────────
exports.returnSw = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { license_ids, sw_ids } = req.body;

  const hasLicenses = Array.isArray(license_ids) && license_ids.length > 0;
  const hasSw       = Array.isArray(sw_ids)      && sw_ids.length > 0;

  if (!hasLicenses && !hasSw) {
    return res.status(400).json({ message: '반납할 라이선스 또는 SW를 선택해주세요.' });
  }

  if (hasSw && role !== 'admin') {
    return res.status(403).json({ message: 'SW 직접 반납은 관리자만 할 수 있습니다.' });
  }

  let licenses = [];
  let sws      = [];

  if (hasLicenses) {
    const licenseWhere = { id: { [Op.in]: license_ids }, state: 'in_use' };
    if (role !== 'admin') licenseWhere.user_id = userId;

    licenses = await AssetSwLicense.findAll({ where: licenseWhere });

    if (licenses.length === 0) return res.status(404).json({ message: '반납할 수 있는 라이선스가 없습니다.' });
    if (licenses.length !== license_ids.length) {
      return res.status(400).json({ message: '반납할 수 없는 라이선스가 포함되어 있습니다. (권한 없음 또는 이미 미사용 상태)' });
    }
  }

  if (hasSw) {
    sws = await AssetSw.findAll({ where: { id: { [Op.in]: sw_ids }, state: { [Op.ne]: 'returned' } } });

    if (sws.length === 0) return res.status(404).json({ message: '반납할 수 있는 SW가 없습니다.' });
    if (sws.length !== sw_ids.length) {
      return res.status(400).json({ message: '반납할 수 없는 SW가 포함되어 있습니다. (이미 반납됨)' });
    }

    for (const sw of sws) {
      const activeLicenseWhere = { asset_sw_id: sw.id, state: 'in_use' };
      if (hasLicenses) activeLicenseWhere.id = { [Op.notIn]: license_ids };
      const activeLicenseCount = await AssetSwLicense.count({ where: activeLicenseWhere });
      if (activeLicenseCount > 0) {
        return res.status(400).json({
          message: `'${sw.name}'에 사용 중인 라이선스가 있습니다. 라이선스를 먼저 반납하거나 동일 요청에 포함해주세요.`,
        });
      }
    }
  }

  let returnedLicenseCount = 0;
  let returnedSwCount      = 0;

  await sequelize.transaction(async (t) => {
    if (hasLicenses) {
      const affectedSwIds = new Set();

      for (const license of licenses) {
        await AssetSwHistory.create({
          asset_sw_id:  license.asset_sw_id, license_id: license.id, user_id: userId,
          change_type:  'returned', before_value: 'in_use', after_value: 'available',
        }, { transaction: t });

        license.state   = 'available';
        license.user_id = null;
        await license.save({ transaction: t });
        affectedSwIds.add(license.asset_sw_id);
      }
      returnedLicenseCount = licenses.length;

      const recalcIds = [...affectedSwIds].filter(id => !(hasSw && sw_ids.includes(id)));
      if (recalcIds.length > 0) await recalcSwStateBatch(recalcIds, t);

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

    if (hasSw) {
      for (const sw of sws) {
        await AssetSwHistory.create({
          asset_sw_id:  sw.id, license_id: null, user_id: userId,
          change_type:  'returned', before_value: sw.state, after_value: 'returned',
        }, { transaction: t });
        sw.state = 'returned';
        await sw.save({ transaction: t });
      }
      returnedSwCount = sws.length;
    }
  });

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
// ─────────────────────────────────────────
exports.returnDf = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { item_ids } = req.body;

  if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ message: '반납할 자산을 선택해주세요.' });
  }

  const items = await AssetProjectItem.findAll({
    where: { id: { [Op.in]: item_ids }, state: { [Op.ne]: 'returned' } },
  });

  if (items.length === 0)               return res.status(404).json({ message: '반납할 수 있는 자산이 없습니다.' });
  if (items.length !== item_ids.length) return res.status(400).json({ message: '반납할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      await AssetProjectHistory.create({
        asset_project_item_id: item.id, project_id: item.project_id, user_id: userId,
        change_type: 'returned', before_value: item.state, after_value: 'returned',
      }, { transaction: t });
      item.state       = 'returned';
      item.return_date = new Date();
      await item.save({ transaction: t });
    }
  });

  res.status(200).json({ message: `${items.length}개의 자산이 반납되었습니다.` });
});


// ─────────────────────────────────────────
// Enterprise 자산 이동
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

  const where = { id: { [Op.in]: asset_ids }, state: { [Op.ne]: 'returned' } };
  if (role !== 'admin') where.user_id = userId;

  const assets = await AssetEnterprise.findAll({ where });
  if (assets.length === 0)                return res.status(404).json({ message: '이동할 수 있는 자산이 없습니다.' });
  if (assets.length !== asset_ids.length) return res.status(400).json({ message: '이동할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id, user_id: userId,
        change_type: 'move', before_value: asset.location ?? null, after_value: location,
      }, { transaction: t });
      asset.location = location;
      await asset.save({ transaction: t });
    }
  });

  res.status(200).json({ message: `${assets.length}개의 자산 위치가 변경되었습니다.` });
});


// ─────────────────────────────────────────
// DF 자산 이동
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
    where: { id: { [Op.in]: item_ids }, state: { [Op.ne]: 'returned' } },
  });

  if (items.length === 0)                 return res.status(404).json({ message: '이동할 수 있는 자산이 없습니다.' });
  if (items.length !== item_ids.length)   return res.status(400).json({ message: '이동할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      await AssetProjectHistory.create({
        asset_project_item_id: item.id, project_id: item.project_id, user_id: userId,
        change_type: 'move', before_value: item.location ?? null, after_value: location,
      }, { transaction: t });
      item.location = location;
      await item.save({ transaction: t });
    }
  });

  res.status(200).json({ message: `${items.length}개의 자산 위치가 변경되었습니다.` });
});


// ─────────────────────────────────────────
// DF 대시보드
// [Rev13] end_project 필드 추가
// ─────────────────────────────────────────
exports.getDfDashboard = asyncWrapper(async (req, res) => {
  const items = await AssetProjectItem.findAll({
    where: {},
    attributes: ['id', 'project_id', 'asset_type_id', 'state'],
    include: [
      { model: AssetProject,         as: 'project',   attributes: ['id', 'name'] },
      { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name'] },
    ],
  });

  const projectMap = {};
  for (const item of items) {
    const pid   = item.project_id;
    const pname = item.project?.name ?? '미지정';

    if (!projectMap[pid]) {
      projectMap[pid] = { id: pid, name: pname, total_count: 0, by_type: {}, all_returned: true };
    }

    projectMap[pid].total_count += 1;

    if (item.state !== 'returned') {
      projectMap[pid].all_returned = false;
    }

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
    end_project: p.all_returned,
  })).sort((a, b) => a.name.localeCompare(b.name));

  res.status(200).json({ total: items.length, projects });
});


// ─────────────────────────────────────────
// 내자산 대시보드 (admin 전용)
// [Fix] s.User → l.User (라이선스 레벨 User 접근)
// ─────────────────────────────────────────
exports.getDashboard = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const swList = await AssetSw.findAll({
    where: { state: { [Op.ne]: 'returned' } },
    attributes: ['id', 'name', 'version', 'manufacturer', 'quantity', 'license_required', 'sw_type', 'state', 'related_link'],
    include: [{
      model: AssetSwLicense,
      as: 'licenses',
      attributes: ['id', 'license_key', 'license_password', 'key_type', 'license_type', 'user_note', 'state', 'user_id'],
      include: [USER_INCLUDE],
    }],
    order: [['name', 'ASC']],
  });

  const sw = swList.map((s) => {
    const inUseCount = s.licenses.filter(l => l.state === 'in_use').length;
    return {
      id:               s.id,
      name:             s.name,
      version:          s.version,
      manufacturer:     s.manufacturer,
      quantity:         s.quantity,
      license_required: s.license_required,
      sw_type:          s.sw_type,
      state:            s.state,
      related_link:     s.related_link,
      in_use_count:     inUseCount,
      available_count:  s.quantity - inUseCount,
      licenses: s.licenses.map((l) => ({
        id:               l.id,
        license_key:      l.license_key,
        license_password: l.license_password,
        key_type:         l.key_type,
        license_type:     l.license_type,
        user_note:        l.user_note,
        state:            l.state,
        user: l.User ? {           // [Fix] s.User → l.User
          id:    l.User.id,
          email: l.User.email,
          role:  l.User.role,
          name:  l.User.profile?.name ?? null,
        } : null,
      })),
    };
  });

  const swTotal = {
    total_sw_count:      sw.length,
    total_license_count: sw.reduce((acc, s) => acc + s.quantity, 0),
    total_in_use:        sw.reduce((acc, s) => acc + s.in_use_count, 0),
    list: sw,
  };

  const [enterpriseTotal, countRows, itemTypes] = await Promise.all([
    AssetEnterprise.count({ where: { state: { [Op.ne]: 'returned' } } }),
    AssetEnterprise.findAll({
      where: { state: { [Op.ne]: 'returned' } },
      attributes: [
        'item_type_id',
        [sequelize.fn('COUNT', sequelize.col('AssetEnterprise.id')), 'count'],
      ],
      group: ['item_type_id'],
      raw: true,
    }),
    AssetEnterpriseItemType.findAll({ attributes: ['id', 'code', 'name'], order: [['name', 'ASC']] }),
  ]);

  const countMap = Object.fromEntries(countRows.map((r) => [r.item_type_id, parseInt(r.count, 10)]));

  const enterprise = {
    total_count:  enterpriseTotal,
    by_item_type: itemTypes
      .map((t) => ({ id: t.id, code: t.code, name: t.name, count: countMap[t.id] || 0 }))
      .filter((t) => t.count > 0),
  };

  res.status(200).json({ sw: swTotal, enterprise });
});


// ─────────────────────────────────────────
// SW 전체 조회 (admin 전용)
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
      id:               sw.id,
      name:             sw.name,
      version:          sw.version,
      manufacturer:     sw.manufacturer,
      quantity:         sw.quantity,
      license_required: sw.license_required,
      sw_type:          sw.sw_type,
      acquisition_date: sw.acquisition_date,
      state:            sw.state,
      related_link:     sw.related_link,
      remarks:          sw.remarks,
      in_use_count:     inUseCount,
      available_count:  sw.quantity - inUseCount,
      created_at:       sw.created_at,
      updated_at:       sw.updated_at,
      licenses: sw.licenses.map(l => ({
        id:               l.id,
        license_key:      l.license_key,
        license_password: l.license_password,
        key_type:         l.key_type,
        license_type:     l.license_type,
        user_note:        l.user_note,
        state:            l.state,
        issue_date:       l.issue_date,
        user: l.User ? { id: l.User.id, email: l.User.email, role: l.User.role, name: l.User.profile?.name } : null,
      })),
    };
  });

  res.status(200).json({ total: result.length, list: result });
});


// ─────────────────────────────────────────
// SW 목록 조회 (등록용 콤보박스)
// ─────────────────────────────────────────
exports.getSwListSimple = asyncWrapper(async (req, res) => {
  const { keyword } = req.query;

  const where = { state: { [Op.ne]: 'returned' } };
  if (keyword) {
    where[Op.or] = [
      { name:         { [Op.like]: `%${keyword}%` } },
      { manufacturer: { [Op.like]: `%${keyword}%` } },
    ];
  }

  const list = await AssetSw.findAll({
    where,
    attributes: ['id', 'name', 'manufacturer', 'version', 'license_required', 'sw_type', 'state', 'related_link', 'quantity'],
    order: [['name', 'ASC']],
  });

  res.status(200).json({ total: list.length, list });
});


// ─────────────────────────────────────────
// SW 할당 가능 목록 조회
// [Fix] sw.User 필드 제거 (AssetSw ↔ User 직접 연관 없음)
// ─────────────────────────────────────────
exports.getSwAvailable = asyncWrapper(async (req, res) => {
  const { keyword } = req.query;
  const isAdmin = req.user.role === 'admin';

  const keywordWhere = keyword ? {
    [Op.or]: [
      { name:         { [Op.like]: `%${keyword}%` } },
      { manufacturer: { [Op.like]: `%${keyword}%` } },
    ],
  } : {};

  const SW_ATTRS = ['id', 'name', 'manufacturer', 'version', 'license_required', 'sw_type', 'state', 'quantity'];

  const licenseTypeSw = await AssetSw.findAll({
    where: { state: { [Op.ne]: 'returned' }, license_required: true, ...keywordWhere },
    attributes: SW_ATTRS,
    include: [{
      model:      AssetSwLicense,
      as:         'licenses',
      where:      { state: 'available' },
      attributes: isAdmin
        ? ['id', 'license_key', 'license_password', 'key_type', 'license_type']
        : ['id', 'key_type', 'license_type'],
      required: true,
    }],
  });

  const subscriptionSw = await AssetSw.findAll({
    where: { state: { [Op.ne]: 'returned' }, license_required: false, ...keywordWhere },
    attributes: SW_ATTRS,
  });

  const allSwIds = [
    ...licenseTypeSw.map(s => s.id),
    ...subscriptionSw.map(s => s.id),
  ];

  let inUseCountMap = {};
  if (allSwIds.length > 0) {
    const inUseCounts = await AssetSwLicense.findAll({
      where:      { asset_sw_id: { [Op.in]: allSwIds }, state: 'in_use' },
      attributes: ['asset_sw_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group:      ['asset_sw_id'],
      raw:        true,
    });
    inUseCountMap = Object.fromEntries(inUseCounts.map(r => [r.asset_sw_id, Number(r.count)]));
  }

  const result = [
    ...licenseTypeSw.map(sw => {
      const inUseCount = inUseCountMap[sw.id] ?? 0;
      return {
        id:               sw.id,
        name:             sw.name,
        manufacturer:     sw.manufacturer,
        version:          sw.version,
        license_required: true,
        sw_type:          sw.sw_type,
        state:            sw.state,
        quantity:         sw.quantity,
        available_count:  sw.licenses.length,
        in_use_count:     inUseCount,
        available_licenses: sw.licenses.map(l => ({
          id:           l.id,
          key_type:     l.key_type,
          license_type: l.license_type,
          ...(isAdmin && { license_key: l.license_key, license_password: l.license_password }),
        })),
      };
    }),
    ...subscriptionSw.map(sw => {
      const inUseCount    = inUseCountMap[sw.id] ?? 0;
      const availableCount = Math.max(0, sw.quantity - inUseCount);
      return {
        id:               sw.id,
        name:             sw.name,
        manufacturer:     sw.manufacturer,
        version:          sw.version,
        license_required: false,
        sw_type:          sw.sw_type,
        state:            sw.state,
        quantity:         sw.quantity,
        available_count:  availableCount,
        in_use_count:     inUseCount,
        available_licenses: [],
        // [Fix] sw.User 필드 제거 — AssetSw는 User와 직접 연관 없음
      };
    }),
  ].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  res.status(200).json({ total: result.length, list: result });
});


// ─────────────────────────────────────────
// SW 라이선스 할당 (admin 전용)
// ─────────────────────────────────────────
exports.assignSwLicense = asyncWrapper(async (req, res) => {
  const { role, userId: adminId } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { license_id, asset_sw_id, user_id } = req.body;

  if (!user_id) return res.status(400).json({ message: '할당할 사용자 ID를 입력해주세요.' });
  if (!license_id && !asset_sw_id) {
    return res.status(400).json({ message: '라이선스 ID 또는 SW ID를 입력해주세요.' });
  }

  const targetUser = await User.findByPk(user_id);
  if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  if (license_id) {
    const license = await AssetSwLicense.findByPk(license_id);
    if (!license) return res.status(404).json({ message: '라이선스를 찾을 수 없습니다.' });
    if (license.state !== 'available') {
      return res.status(400).json({ message: '사용 가능한 상태의 라이선스만 할당할 수 있습니다.' });
    }

    await sequelize.transaction(async (t) => {
      const lockedLicense = await AssetSwLicense.findByPk(license_id, { lock: t.LOCK.UPDATE, transaction: t });
      if (lockedLicense.state !== 'available') {
        const err = new Error('이미 할당된 라이선스입니다. 다시 확인해주세요.'); err.statusCode = 409; throw err;
      }

      await AssetSwHistory.create({
        asset_sw_id: lockedLicense.asset_sw_id, license_id: lockedLicense.id, user_id: adminId,
        change_type: 'assign', before_value: 'available', after_value: 'in_use',
      }, { transaction: t });

      lockedLicense.state   = 'in_use';
      lockedLicense.user_id = user_id;
      await lockedLicense.save({ transaction: t });
      await recalcSwState(lockedLicense.asset_sw_id, t);
    });

    return res.status(200).json({ message: '라이선스가 할당되었습니다.', license_id, user_id });
  }

  const sw = await AssetSw.findByPk(asset_sw_id);
  if (!sw) return res.status(404).json({ message: 'SW를 찾을 수 없습니다.' });
  if (sw.state === 'returned') return res.status(400).json({ message: '반납된 SW입니다.' });
  if (sw.license_required) {
    return res.status(400).json({ message: '라이선스형 SW는 license_id로 할당해주세요.' });
  }

  const newLicense = await sequelize.transaction(async (t) => {
    const license = await AssetSwLicense.create({
      asset_sw_id:      Number(asset_sw_id), user_id: Number(user_id),
      user_note:        null, license_key: null, license_password: null,
      key_type:         null, license_type: 'per_seat', state: 'in_use',
    }, { transaction: t });

    await AssetSwHistory.create({
      asset_sw_id:  Number(asset_sw_id), license_id: license.id, user_id: adminId,
      change_type:  'assign', before_value: null, after_value: 'in_use',
    }, { transaction: t });

    const lockedSw = await AssetSw.findByPk(Number(asset_sw_id), { lock: t.LOCK.UPDATE, transaction: t });
    const currentInUseCount = await AssetSwLicense.count({
      where: { asset_sw_id: Number(asset_sw_id), state: 'in_use' }, transaction: t,
    });

    if (!lockedSw) {
      const err = new Error('SW를 찾을 수 없습니다.'); err.statusCode = 404; throw err;
    }
    if (lockedSw.quantity > 0 && currentInUseCount > lockedSw.quantity) {
      const err = new Error(`할당 가능 수량(${lockedSw.quantity}개)을 초과했습니다.`); err.statusCode = 400; throw err;
    }

    await recalcSwState(Number(asset_sw_id), t);
    return license;
  });

  res.status(200).json({ message: '구독형 SW가 할당되었습니다.', license_id: newLicense.id, asset_sw_id, user_id });
});


// ─────────────────────────────────────────
// SW 라이선스 할당 요청 (user)
// [Fix] 구독형 SW 분기 복구 (license_id 불필요)
// ─────────────────────────────────────────
exports.requestSwAssign = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { asset_sw_id, license_id, request_reason } = req.body;

  if (!asset_sw_id) return res.status(400).json({ message: 'SW ID를 입력해주세요.' });

  const sw = await AssetSw.findByPk(asset_sw_id);
  if (!sw) return res.status(404).json({ message: 'SW를 찾을 수 없습니다.' });
  if (sw.state === 'returned') return res.status(400).json({ message: '반납된 SW입니다.' });

  // ── 구독형 SW: license_id 불필요 ─────────────────────────────────
  if (!sw.license_required) {
    const request = await AssetSwRequest.create({
      asset_sw_id:       Number(asset_sw_id),
      requester_id:      userId,
      status:            'pending',
      request_type:      'assign',
      request_date:      new Date(),
      required_quantity: 1,
      request_reason:    request_reason ?? null,
      new_asset_data:    JSON.stringify({ subscription_assign: true }),
    });

    await AssetSwHistory.create({
      asset_sw_id:  Number(asset_sw_id), license_id: null, user_id: userId,
      change_type:  'request', before_value: null, after_value: 'pending',
    });

    return res.status(201).json({
      message: '구독형 SW 할당 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
      request,
    });
  }

  // ── 라이선스형 SW: license_id 필수 ──────────────────────────────
  if (!license_id) return res.status(400).json({ message: '라이선스 ID를 입력해주세요.' });

  const license = await AssetSwLicense.findByPk(license_id);
  if (!license) return res.status(404).json({ message: '라이선스를 찾을 수 없습니다.' });
  if (Number(license.asset_sw_id) !== Number(asset_sw_id)) {
    return res.status(400).json({ message: '해당 SW에 속하지 않는 라이선스입니다.' });
  }
  if (license.state !== 'available') {
    return res.status(400).json({ message: '사용 가능한 상태의 라이선스만 요청할 수 있습니다.' });
  }

  const request = await AssetSwRequest.create({
    asset_sw_id:       Number(asset_sw_id),
    requester_id:      userId,
    status:            'pending',
    request_type:      'assign',
    request_date:      new Date(),
    required_quantity: 1,
    request_reason:    request_reason ?? null,
    new_asset_data:    JSON.stringify({ license_id: Number(license_id) }),
  });

  await AssetSwHistory.create({
    asset_sw_id:  Number(asset_sw_id), license_id: Number(license_id), user_id: userId,
    change_type:  'request', before_value: 'available', after_value: 'pending',
  });

  res.status(201).json({
    message: '라이선스 할당 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    request,
  });
});


// ─────────────────────────────────────────
// Enterprise(PC) 전체 조회 (admin 전용)
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
          model: Profile, as: 'profile',
          attributes: ['name', 'department_id', 'company_rank'],
          include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
        }],
      },
    ],
    order: [['created_at', 'DESC']],
  });

  res.status(200).json({
    total: list.length,
    list: list.map(e => {
      const p = e.toJSON();
      p.item_number = buildItemNumber(p);
      return p;
    }),
  });
});


// ─────────────────────────────────────────
// Enterprise 목록 조회 (등록용 콤보박스)
// ─────────────────────────────────────────
exports.getEnterpriseListSimple = asyncWrapper(async (req, res) => {
  const rows = await AssetEnterprise.findAll({
    where: { state: { [Op.ne]: 'returned' } },
    attributes: [
      'category_id', 'item_type_id', 'manufacturer',
      [sequelize.fn('COUNT', sequelize.col('AssetEnterprise.id')), 'cnt'],
    ],
    include: [
      { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
      { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name', 'code'] },
    ],
    group: ['category_id', 'item_type_id', 'manufacturer'],
    raw: false,
  });

  const categoryMap = {};

  for (const row of rows) {
    const cat  = row.item_category;
    const type = row.item_type;
    if (!cat || !type) continue;

    if (!categoryMap[cat.id]) {
      categoryMap[cat.id] = { id: cat.id, name: cat.name, item_types: {} };
    }

    const typeMap = categoryMap[cat.id].item_types;
    if (!typeMap[type.id]) {
      typeMap[type.id] = { id: type.id, name: type.name, code: type.code, manufacturers: [] };
    }

    if (row.manufacturer) typeMap[type.id].manufacturers.push(row.manufacturer);
  }

  const categories = Object.values(categoryMap)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((cat) => ({
      id:   cat.id,
      name: cat.name,
      item_types: Object.values(cat.item_types)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .map((t) => ({
          id:            t.id,
          name:          t.name,
          code:          t.code,
          manufacturers: t.manufacturers.sort((a, b) => a.localeCompare(b, 'ko')),
        })),
    }));

  res.status(200).json({ categories });
});


// ─────────────────────────────────────────
// Enterprise 할당 가능 목록 조회
// ─────────────────────────────────────────
exports.getEnterpriseAvailable = asyncWrapper(async (req, res) => {
  const { category_id, item_type_id, keyword } = req.query;

  const where = { state: 'stored', responsible_type: 'vacant' };
  if (category_id)  where.category_id  = Number(category_id);
  if (item_type_id) where.item_type_id = Number(item_type_id);
  if (keyword) {
    where[Op.or] = [
      { manufacturer:  { [Op.like]: `%${keyword}%` } },
      { serial_number: { [Op.like]: `%${keyword}%` } },
    ];
  }

  const list = await AssetEnterprise.findAll({
    where,
    attributes: ['id', 'manufacturer', 'serial_number', 'spec', 'location', 'acquisition_date'],
    include: [
      { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
      { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name', 'code'] },
    ],
    order: [['id', 'ASC']],
  });

  res.status(200).json({
    total: list.length,
    list: list.map(e => {
      const p = e.toJSON();
      p.item_number = buildItemNumber(p);
      return p;
    }),
  });
});


// ─────────────────────────────────────────
// 내자산 히스토리 조회
// ─────────────────────────────────────────
exports.getPersonalHistory = asyncWrapper(async (req, res) => {
  const { userId, role } = req.user;
  const { type, asset_sw_id, item_type_id, from, to } = req.query;

  let swHistory = [];
  let enterpriseHistory = [];

  if (!type || type === 'sw') {
    const swWhere = { ...buildDateWhere('created_at', from, to) };
    if (role !== 'admin') swWhere.user_id = userId;

    const swInclude = [
      {
        model: AssetSw, as: 'sw',
        attributes: ['id', 'name', 'version', 'manufacturer'],
        ...(asset_sw_id ? { where: { id: Number(asset_sw_id) } } : {}),
        required: !!asset_sw_id,
      },
      { model: AssetSwLicense, as: 'license', attributes: ['id', 'license_key', 'key_type'] },
      { ...USER_INCLUDE, as: 'changedBy' },
    ];

    swHistory = await AssetSwHistory.findAll({
      where: swWhere, include: swInclude, order: [['created_at', 'DESC']],
    });
  }

  if (!type || type === 'enterprise') {
    const entWhere = { ...buildDateWhere('created_at', from, to) };
    if (role !== 'admin') entWhere.user_id = userId;

    const entInclude = [
      {
        model: AssetEnterprise, as: 'asset',
        attributes: ['id', 'manufacturer', 'serial_number', 'state'],
        ...(item_type_id ? { where: { item_type_id: Number(item_type_id) } } : {}),
        required: !!item_type_id,
        include: [{ model: AssetEnterpriseItemType, as: 'item_type', attributes: ['id', 'name', 'code'] }],
      },
      { ...USER_INCLUDE, as: 'changedBy' },
    ];

    enterpriseHistory = await AssetEnterpriseHistory.findAll({
      where: entWhere, include: entInclude, order: [['created_at', 'DESC']],
    });
  }

  res.status(200).json({ sw: swHistory, enterprise: enterpriseHistory });
});


// ─────────────────────────────────────────
// Enterprise 자산 할당 요청 (user)
// ─────────────────────────────────────────
exports.requestEnterpriseAssign = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { asset_id, request_reason } = req.body;

  if (!asset_id) return res.status(400).json({ message: '자산 ID를 입력해주세요.' });

  const asset = await AssetEnterprise.findByPk(asset_id, {
    include: [
      { model: AssetEnterpriseCategory, as: 'item_category', attributes: ['id', 'name'] },
      { model: AssetEnterpriseItemType, as: 'item_type',     attributes: ['id', 'name', 'code'] },
    ],
  });
  if (!asset) return res.status(404).json({ message: '자산을 찾을 수 없습니다.' });
  if (asset.state !== 'stored' || asset.responsible_type !== 'vacant') {
    return res.status(400).json({ message: '보관 중이며 담당자가 없는 자산만 할당 요청할 수 있습니다.' });
  }

  const existingPending = await AssetEnterpriseRequest.findOne({
    where: { asset_id, status: 'pending', request_type: 'assign' },
  });
  if (existingPending) {
    return res.status(409).json({ message: '해당 자산에 이미 처리 중인 할당 요청이 있습니다.' });
  }

  const request = await AssetEnterpriseRequest.create({
    asset_id:          Number(asset_id),
    requester_id:      userId,
    status:            'pending',
    request_type:      'assign',
    request_date:      new Date(),
    required_quantity: 1,
    request_reason:    request_reason ?? null,
    new_asset_data:    null,
  });

  await AssetEnterpriseHistory.create({
    asset_enterprise_id: Number(asset_id), user_id: userId,
    change_type: 'request', before_value: asset.state, after_value: 'pending',
  });

  res.status(201).json({
    message: '자산 할당 요청이 완료되었습니다. 관리자 승인을 기다려주세요.',
    request,
  });
});


// ─────────────────────────────────────────
// Enterprise 자산 직접 할당 (admin 전용)
// ─────────────────────────────────────────
exports.assignEnterprise = asyncWrapper(async (req, res) => {
  const { role, userId: adminId } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { asset_id, user_id } = req.body;

  if (!asset_id) return res.status(400).json({ message: '자산 ID를 입력해주세요.' });
  if (!user_id)  return res.status(400).json({ message: '할당할 사용자 ID를 입력해주세요.' });

  const asset = await AssetEnterprise.findByPk(asset_id);
  if (!asset) return res.status(404).json({ message: '자산을 찾을 수 없습니다.' });
  if (asset.state !== 'stored' || asset.responsible_type !== 'vacant') {
    return res.status(400).json({ message: '보관 중이며 담당자가 없는 자산만 할당할 수 있습니다.' });
  }

  const targetUser = await User.findByPk(user_id);
  if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  await sequelize.transaction(async (t) => {
    const lockedAsset = await AssetEnterprise.findByPk(asset_id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!lockedAsset) {
      const err = new Error('자산을 찾을 수 없습니다.'); err.statusCode = 404; throw err;
    }
    if (lockedAsset.state !== 'stored' || lockedAsset.responsible_type !== 'vacant') {
      const err = new Error('현재 할당할 수 없는 상태입니다. 자산 상태를 확인해주세요.'); err.statusCode = 409; throw err;
    }

    const autoLocation = await resolveLocationByResponsible(
      { userId: user_id, departmentId: lockedAsset.department_id ?? null, responsibleType: 'personal' },
      t,
    );

    await AssetEnterpriseHistory.create({
      asset_enterprise_id: lockedAsset.id, user_id: adminId,
      change_type: 'assign', before_value: lockedAsset.state, after_value: 'in_use',
    }, { transaction: t });

    lockedAsset.state            = 'in_use';
    lockedAsset.responsible_type = 'personal';
    lockedAsset.user_id          = user_id;
    lockedAsset.location         = autoLocation;
    await lockedAsset.save({ transaction: t });
  });

  res.status(200).json({ message: '자산이 할당되었습니다.', asset_id, user_id });
});


// ─────────────────────────────────────────
// DF 히스토리 조회
// ─────────────────────────────────────────
exports.getDfHistory = asyncWrapper(async (req, res) => {
  const { project_id, asset_type_id, from, to } = req.query;

  const where = {};
  if (project_id) where.project_id = Number(project_id);
  Object.assign(where, buildDateWhere('created_at', from, to));

  const itemInclude = {
    model: AssetProjectItem, as: 'item',
    attributes: ['id', 'item_number', 'model_number', 'manufacturer', 'serial_number', 'state'],
    ...(asset_type_id ? { where: { asset_type_id: Number(asset_type_id) } } : {}),
    required: !!asset_type_id,
    include: [{ model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name'] }],
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
// SW 히스토리 아카이빙
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
      HistoryModel: AssetSwHistory, ArchiveModel: AssetSwHistoryArchive,
      where, userId, archiveRange, t,
      mapFn: (h) => ({
        history_id:   h.id, asset_sw_id: h.asset_sw_id, license_id: h.license_id,
        user_id:      h.user_id, change_type: h.change_type,
        before_value: h.before_value, after_value: h.after_value, created_at: h.created_at,
      }),
    });
  });

  if (archived === 0) return res.status(200).json({ message: '아카이빙할 데이터가 없습니다.', archived: 0 });
  res.status(200).json({ message: `SW 히스토리 ${archived}건이 아카이빙되었습니다.`, archived, archive_range: archiveRange });
});


// ─────────────────────────────────────────
// Enterprise 히스토리 아카이빙
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
      HistoryModel: AssetEnterpriseHistory, ArchiveModel: AssetEnterpriseHistoryArchive,
      where, userId, archiveRange, t,
      mapFn: (h) => ({
        history_id:          h.id, asset_enterprise_id: h.asset_enterprise_id,
        user_id:             h.user_id, change_type: h.change_type,
        before_value:        h.before_value, after_value: h.after_value, created_at: h.created_at,
      }),
    });
  });

  if (archived === 0) return res.status(200).json({ message: '아카이빙할 데이터가 없습니다.', archived: 0 });
  res.status(200).json({ message: `Enterprise 히스토리 ${archived}건이 아카이빙되었습니다.`, archived, archive_range: archiveRange });
});


// ─────────────────────────────────────────
// DF 히스토리 아카이빙
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
      HistoryModel: AssetProjectHistory, ArchiveModel: AssetProjectHistoryArchive,
      where, userId, archiveRange, t,
      mapFn: (h) => ({
        history_id:            h.id, asset_project_item_id: h.asset_project_item_id,
        project_id:            h.project_id, user_id: h.user_id, change_type: h.change_type,
        before_value:          h.before_value, after_value: h.after_value, created_at: h.created_at,
      }),
    });
  });

  if (archived === 0) return res.status(200).json({ message: '아카이빙할 데이터가 없습니다.', archived: 0 });
  res.status(200).json({ message: `DF 히스토리 ${archived}건이 아카이빙되었습니다.`, archived, archive_range: archiveRange });
});


// ─────────────────────────────────────────
// SW 히스토리 아카이브 조회
// ─────────────────────────────────────────
exports.getSwHistoryArchive = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { asset_sw_id, archive_range, from, to } = req.query;
  const where = { ...buildDateWhere('archived_at', from, to) };
  if (asset_sw_id)   where.asset_sw_id   = Number(asset_sw_id);
  if (archive_range) where.archive_range = archive_range;

  const page   = Number(req.query.page)  || 1;
  const limit  = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: list } = await AssetSwHistoryArchive.findAndCountAll({
    where, order: [['archived_at', 'DESC']], limit, offset,
  });

  res.status(200).json({ total: count, list });
});


// ─────────────────────────────────────────
// Enterprise 히스토리 아카이브 조회
// ─────────────────────────────────────────
exports.getEnterpriseHistoryArchive = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { asset_enterprise_id, archive_range, from, to } = req.query;
  const where = { ...buildDateWhere('archived_at', from, to) };
  if (asset_enterprise_id) where.asset_enterprise_id = Number(asset_enterprise_id);
  if (archive_range)       where.archive_range       = archive_range;

  const page   = Number(req.query.page)  || 1;
  const limit  = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: list } = await AssetEnterpriseHistoryArchive.findAndCountAll({
    where, order: [['archived_at', 'DESC']], limit, offset,
  });

  res.status(200).json({ total: count, list });
});


// ─────────────────────────────────────────
// DF 히스토리 아카이브 조회
// ─────────────────────────────────────────
exports.getDfHistoryArchive = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { project_id, asset_project_item_id, archive_range, from, to } = req.query;
  const where = { ...buildDateWhere('archived_at', from, to) };
  if (project_id)            where.project_id            = Number(project_id);
  if (asset_project_item_id) where.asset_project_item_id = Number(asset_project_item_id);
  if (archive_range)         where.archive_range         = archive_range;

  const page   = Number(req.query.page)  || 1;
  const limit  = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows: list } = await AssetProjectHistoryArchive.findAndCountAll({
    where, order: [['archived_at', 'DESC']], limit, offset,
  });

  res.status(200).json({ total: count, list });
});


// ─────────────────────────────────────────
// DF 자산 상태 변경
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
    where: { id: { [Op.in]: item_ids }, state: { [Op.ne]: 'returned' } },
  });

  if (items.length === 0) return res.status(404).json({ message: '상태를 변경할 수 있는 자산이 없습니다.' });
  if (items.length !== item_ids.length) {
    return res.status(400).json({ message: '변경할 수 없는 자산이 포함되어 있습니다. (이미 반납됨)' });
  }

  let changedCount = 0;

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      if (item.state === state) continue;

      await AssetProjectHistory.create({
        asset_project_item_id: item.id, project_id: item.project_id, user_id: userId,
        change_type: 'change', before_value: item.state, after_value: state,
      }, { transaction: t });

      item.state = state;
      await item.save({ transaction: t });
      changedCount++;
    }
  });

  if (changedCount === 0) {
    return res.status(200).json({ message: '이미 해당 상태인 자산만 선택되었습니다.', changed: 0 });
  }
  res.status(200).json({ message: `${changedCount}개의 자산 상태가 변경되었습니다.`, changed: changedCount });
});


// ─────────────────────────────────────────
// Enterprise 자산 상태 변경
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

  const where = { id: { [Op.in]: asset_ids }, state: { [Op.ne]: 'returned' } };
  if (role !== 'admin') where.user_id = userId;

  const assets = await AssetEnterprise.findAll({ where });

  if (assets.length === 0) return res.status(404).json({ message: '상태를 변경할 수 있는 자산이 없습니다.' });
  if (assets.length !== asset_ids.length) {
    return res.status(400).json({ message: '변경할 수 없는 자산이 포함되어 있습니다. (권한 없음 또는 이미 반납됨)' });
  }

  let changedCount = 0;

  await sequelize.transaction(async (t) => {
    for (const asset of assets) {
      if (asset.state === state) continue;

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id, user_id: userId,
        change_type: 'change', before_value: asset.state, after_value: state,
      }, { transaction: t });

      asset.state = state;
      await asset.save({ transaction: t });
      changedCount++;
    }
  });

  if (changedCount === 0) {
    return res.status(200).json({ message: '이미 해당 상태인 자산만 선택되었습니다.', changed: 0 });
  }
  res.status(200).json({ message: `${changedCount}개의 자산 상태가 변경되었습니다.`, changed: changedCount });
});


// ─────────────────────────────────────────
// SW 라이선스 상태 변경 (admin 전용)
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

  const licenses = await AssetSwLicense.findAll({ where: { id: { [Op.in]: license_ids } } });

  if (licenses.length === 0) return res.status(404).json({ message: '라이선스를 찾을 수 없습니다.' });
  if (licenses.length !== license_ids.length) {
    return res.status(400).json({ message: '존재하지 않는 라이선스가 포함되어 있습니다.' });
  }

  let changedCount = 0;

  await sequelize.transaction(async (t) => {
    const affectedSwIds = new Set();

    for (const license of licenses) {
      if (license.state === state) continue;

      await AssetSwHistory.create({
        asset_sw_id:  license.asset_sw_id, license_id: license.id, user_id: userId,
        change_type:  'change', before_value: license.state, after_value: state,
      }, { transaction: t });

      license.state = state;
      await license.save({ transaction: t });
      affectedSwIds.add(license.asset_sw_id);
      changedCount++;
    }

    await recalcSwStateBatch([...affectedSwIds], t);
  });

  if (changedCount === 0) {
    return res.status(200).json({ message: '이미 해당 상태인 라이선스만 선택되었습니다.', changed: 0 });
  }
  res.status(200).json({ message: `${changedCount}개의 라이선스 상태가 변경되었습니다.`, changed: changedCount });
});