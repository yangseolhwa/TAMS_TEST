const XLSX = require('xlsx');
const sequelize = require('../config/db');
const { AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory } = require('../models');

const VALID_STATES = ['active', 'stored', 'rented', 'returned'];

// '-' 또는 빈 값 → null 처리
function toVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
}

// 날짜 파싱 (Date 객체 or ISO 문자열 모두 처리)
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

  // 시트명 정규화: 언더스코어 → 공백
  const sheetNameToDbName = {};
  projectSheets.forEach((s) => {
    sheetNameToDbName[s] = s.replace(/_/g, ' ');
  });

  // 프로젝트 캐시
  const projectCache = {};

  // asset_type 캐시
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
    // xlsx JS는 선행 빈 열(A열) 제거 후 배열 구성
    // row[0]=헤더행, row[1]부터 실제 데이터
    // 컬럼 매핑 (0-based, A열 없음):
    //   [0]:number [1]:doosan_item_number [2]:asset_type [3]:manufacturer
    //   [4]:model_name [5]:serial_number [6]:spec [7]:quantity
    //   [8]:rental_date [9]:return_date [10]:state [11]:location [12]:remarks
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const dataRows = rows.slice(1); // row[0]=헤더 제외, row[1]부터 데이터

    // carry-forward: 병합 셀 처리
    // 고유값 컬럼(병합 불가) 제외: index 0(number), 1(doosan_item_number), 5(serial_number)
    const CARRY_INDEXES = [2, 3, 4, 6, 7, 8, 9, 10, 11, 12];
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
      const rowNum = i + 2; // 엑셀 실제 행 번호 (헤더=1행, 데이터=2행~)

      const assetTypeName      = toVal(row[2]);
      const manufacturer       = toVal(row[3]);
      const model_name         = toVal(row[4]);
      const serial_number      = toVal(row[5]);
      const spec               = toVal(row[6]);
      const quantityRaw        = row[7];
      const rentalDateRaw      = row[8];
      const returnDateRaw      = row[9];
      const stateRaw           = toVal(row[10]);
      const location           = toVal(row[11]);
      const remarks            = toVal(row[12]);
      const doosan_item_number = toVal(row[1]);

      // 완전히 빈 행 건너뛰기
      if (!assetTypeName && !manufacturer && !model_name) continue;

      // 필수 필드 검증
      if (!assetTypeName) {
        results.push({ project: sheetName, row: rowNum, status: 'failed', reason: 'asset_type이 없습니다.' });
        failed++; continue;
      }
      if (!manufacturer) {
        results.push({ project: sheetName, row: rowNum, status: 'failed', reason: '제조사(manufacturer)가 없습니다.' });
        failed++; continue;
      }
      if (!model_name) {
        results.push({ project: sheetName, row: rowNum, status: 'failed', reason: '모델명(model_name)이 없습니다.' });
        failed++; continue;
      }

      const quantity = Number(quantityRaw);
      if (quantityRaw == null || isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
        results.push({ project: sheetName, row: rowNum, status: 'failed', reason: '수량(quantity)은 1 이상의 정수여야 합니다.' });
        failed++; continue;
      }

      const rental_start_date = parseDate(rentalDateRaw);
      if (!rental_start_date) {
        results.push({ project: sheetName, row: rowNum, status: 'failed', reason: '대여일(rental_date) 형식이 올바르지 않습니다.' });
        failed++; continue;
      }

      // asset_type findOrCreate
      if (!typeCache[assetTypeName]) {
        const [newType] = await AssetProjectItemType.findOrCreate({
          where: { name: assetTypeName },
          defaults: { name: assetTypeName, is_cable: false },
        });
        typeCache[assetTypeName] = newType.id;
      }
      const asset_type_id = typeCache[assetTypeName];

      const rental_end_date = parseDate(returnDateRaw);
      const state = stateRaw && VALID_STATES.includes(stateRaw) ? stateRaw : 'active';

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
            user_id: req.user.id,
            project_id,
            item_number,
            asset_type_id,
            doosan_item_number: doosan_item_number || null,
            manufacturer,
            model_name,
            serial_number: serial_number || null,
            spec: spec || null,
            quantity,
            quantity_unit: 'ea',
            rental_start_date,
            rental_end_date: rental_end_date || null,
            state,
            location: location || null,
            remarks: remarks || null,
          },
          { transaction: t }
        );

        await AssetProjectHistory.create(
          {
            asset_project_item_id: item.id,
            project_id,
            change_by: req.user.id,
            change_type: 'register',
            location_before: null,
            location_after: location || null,
            rental_start_date,
            rental_end_date: rental_end_date || null,
            state,
          },
          { transaction: t }
        );

        await t.commit();
        results.push({
          project: sheetName,
          project_created: projectIsNew,
          row: rowNum,
          status: 'success',
          item_id: item.id,
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