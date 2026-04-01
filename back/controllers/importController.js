const XLSX = require('xlsx');
const sequelize = require('../config/db');
const { AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory } = require('../models');

const VALID_STATES = ['in_use', 'stored', 'rented', 'returned'];

// ── 컬럼 인덱스 상수 ─────────────────────────────────────────────
// 엑셀 헤더 순서 (B열부터): number, asset_type, owner_organization, equipment_number,
// manufacturer, model_name, serial_number, spec, acquisition_date, return_date, state, location, remarks
const COL = {
  NUMBER:             0,
  ASSET_TYPE:         1,
  OWNER_ORGANIZATION: 2,
  EQUIPMENT_NUMBER:   3,
  MANUFACTURER:       4,
  MODEL_NAME:         5,
  SERIAL_NUMBER:      6,
  SPEC:               7,
  ACQUISITION_DATE:   8,
  RETURN_DATE:        9,
  STATE:              10,
  LOCATION:           11,
  REMARKS:            12,
};

// carry-forward 적용 컬럼 (고유값 제외: NUMBER, EQUIPMENT_NUMBER, SERIAL_NUMBER)
const CARRY_INDEXES = [
  COL.ASSET_TYPE, COL.OWNER_ORGANIZATION, COL.MANUFACTURER, COL.MODEL_NAME,
  COL.SPEC, COL.ACQUISITION_DATE, COL.RETURN_DATE, COL.STATE,
  COL.LOCATION, COL.REMARKS,
];

function toVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (s === '' || s === '-') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const importDf = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '파일이 없습니다.' });
  }

  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  } catch (e) {
    return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' });
  }

  const projectSheets = wb.SheetNames.filter((name) => name !== 'TOTAL');
  if (projectSheets.length === 0) {
    return res.status(400).json({ message: 'TOTAL 시트 외 프로젝트 시트가 없습니다.' });
  }

  const sheetNameToDbName = {};
  projectSheets.forEach((s) => { sheetNameToDbName[s] = s.replace(/_/g, ' '); });

  const projectCache = {};
  const typeCache = {};
  const existingTypes = await AssetProjectItemType.findAll();
  existingTypes.forEach((t) => { typeCache[t.name] = t.id; });

  const results = [];
  let imported = 0;
  let failed = 0;

  for (const sheetName of projectSheets) {
    const dbName = sheetNameToDbName[sheetName];

    if (!projectCache[dbName]) {
      const [project, isNew] = await AssetProject.findOrCreate({
        where: { name: dbName },
        defaults: { name: dbName },
      });
      projectCache[dbName] = { id: project.id, isNew };
    }
    const { id: project_id, isNew: projectIsNew } = projectCache[dbName];

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const dataRows = rows.slice(1); // row[0]=헤더 제외

    // carry-forward: 병합 셀 처리
    const lastVals = {};
    for (const row of dataRows) {
      for (const idx of CARRY_INDEXES) {
        const cur = toVal(row[idx]) ?? (row[idx] instanceof Date ? row[idx] : null);
        if (cur !== null) lastVals[idx] = row[idx];
        else row[idx] = lastVals[idx] ?? null;
      }
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      const assetTypeName      = toVal(row[COL.ASSET_TYPE]);
      const owner_organization = toVal(row[COL.OWNER_ORGANIZATION]);
      const equipment_number   = toVal(row[COL.EQUIPMENT_NUMBER]);
      const manufacturer       = toVal(row[COL.MANUFACTURER]);
      const model_name         = toVal(row[COL.MODEL_NAME]);
      const serial_number      = toVal(row[COL.SERIAL_NUMBER]);
      const spec               = toVal(row[COL.SPEC]);
      const acquisitionDateRaw = row[COL.ACQUISITION_DATE];
      const returnDateRaw      = row[COL.RETURN_DATE];
      const stateRaw           = toVal(row[COL.STATE]);
      const location           = toVal(row[COL.LOCATION]);
      const remarks            = toVal(row[COL.REMARKS]);

      // 완전히 빈 행 건너뛰기
      if (!assetTypeName && !manufacturer && !model_name) continue;

      // ── 유효성 검사 ──────────────────────────────────────────────
      const acquisition_date = parseDate(acquisitionDateRaw);

      const validations = [
        { check: assetTypeName,    message: 'asset_type이 없습니다.' },
        { check: manufacturer,     message: '제조사(manufacturer)가 없습니다.' },
        { check: model_name,       message: '모델명(model_name)이 없습니다.' },
        { check: acquisition_date, message: '취득일(acquisition_date) 형식이 올바르지 않습니다.' },
      ];

      let validationFailed = false;
      for (const v of validations) {
        if (!v.check) {
          results.push({ project: sheetName, row: rowNum, status: 'failed', reason: v.message });
          failed++;
          validationFailed = true;
          break;
        }
      }
      if (validationFailed) continue;

      // asset_type findOrCreate
      if (!typeCache[assetTypeName]) {
        const [newType] = await AssetProjectItemType.findOrCreate({
          where: { name: assetTypeName },
          defaults: { name: assetTypeName, parent_id: null },
        });
        typeCache[assetTypeName] = newType.id;
      }
      const asset_type_id = typeCache[assetTypeName];
      const return_date   = parseDate(returnDateRaw);
      const state         = stateRaw && VALID_STATES.includes(stateRaw) ? stateRaw : 'in_use';

      const t = await sequelize.transaction();
      try {
        const lastItem = await AssetProjectItem.findOne({
          where: { project_id },
          order: [['item_number', 'DESC']],
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        const item_number = lastItem ? lastItem.item_number + 1 : 1;

        const item = await AssetProjectItem.create(
          {
            user_id:            req.user.id,
            project_id,
            item_number,
            asset_type_id,
            owner_organization: owner_organization || null,
            equipment_number:   equipment_number   || null,
            manufacturer,
            model_name,
            serial_number:      serial_number      || null,
            spec:               spec               || null,
            acquisition_date,
            return_date:        return_date        || null,
            state,
            location:           location           || null,
            remarks:            remarks            || null,
          },
          { transaction: t }
        );

        await AssetProjectHistory.create(
          {
            asset_project_item_id: item.id,
            project_id,
            user_id:      req.user.id,
            change_type:  'register',
            before_value: null,
            after_value:  state,
          },
          { transaction: t }
        );

        await t.commit();
        results.push({
          project:         sheetName,
          project_created: projectIsNew,
          row:             rowNum,
          status:          'success',
          item_id:         item.id,
          item_number,
        });
        imported++;
      } catch (err) {
        await t.rollback();
        results.push({ project: sheetName, row: rowNum, status: 'failed', reason: err.message });
        failed++;
      }
    }
  }

  return res.status(200).json({
    message: `Import 완료: ${imported}건 성공, ${failed}건 실패`,
    imported,
    failed,
    results,
  });
};

module.exports = { importDf };