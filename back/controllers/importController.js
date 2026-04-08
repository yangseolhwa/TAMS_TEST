'use strict';

const sequelize = require('../config/db');
const { Op } = require('sequelize');
const {
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
  AssetSw, AssetSwLicense, AssetSwHistory,
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseHistory, Department, Profile, User,
} = require('../models');

// ─────────────────────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────────────────────
const VALID_DF_STATES = ['in_use', 'stored', 'rented', 'returned'];

function toVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return (s === '' || s === '-') ? null : s;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s || s === '-') return null;
  const normalized = s.replace(/\./g, '-');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

const KEY_TYPE_MAP = { '시리얼': 'serial', '링크': 'url', '크레덴셜': 'credential' };
const SPECIAL_USER_PATTERNS = ['sdoe', '공용', '관리자', 'pc'];

function isSpecialUser(name) {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return SPECIAL_USER_PATTERNS.some(p => lower.includes(p));
}

// ─────────────────────────────────────────────────────────────
// DF IMPORT
// ─────────────────────────────────────────────────────────────

/**
 * 시트 헤더를 동적 감지하여 컬럼 인덱스 맵 반환
 * exceljs 기준 1-indexed 컬럼 번호
 */
function detectDfColumns(ws) {
  const KEYWORD_MAP = {
    owner_organization: ['소유 기관', '소유기관'],
    equipment_number:   ['장비 번호', '장비번호'],
    manufacturer:       ['제조사'],
    parent_type:        ['대분류'],
    sub_type:           ['중분류', '소분류', 'card', '중뷴류'],
    model_name:         ['모델명'],
    serial_number:      ['시리얼 넘버', '시리얼넘버'],
    spec:               ['규격'],
    acquisition_date:   ['대여일', '취득일자', '취득일'],
    return_date:        ['반납일'],
    location:           ['위치'],
    remarks:            ['비고'],
  };

  for (let r = 1; r <= 10; r++) {
    const rowVals = [];
    for (let c = 1; c <= 20; c++) {
      const v = ws.getCell(r, c).value;
      rowVals.push(v != null ? String(v).trim() : '');
    }

    // 헤더 행 조건: 대분류 또는 중분류 키워드 포함
    const isHeader = rowVals.some(v => {
      const lower = v.toLowerCase();
      return lower === '대분류' || lower === '중분류' || lower === '소분류'
          || lower === 'card'   || lower === '중뷴류';
    });
    if (!isHeader) continue;

    const colMap = {};
    for (const [key, keywords] of Object.entries(KEYWORD_MAP)) {
      colMap[key] = null;
      for (let c = 0; c < rowVals.length; c++) {
        const cellLower = rowVals[c].toLowerCase();
        if (keywords.some(kw => cellLower === kw.toLowerCase())) {
          colMap[key] = c + 1;
          break;
        }
      }
    }
    return { colMap, headerRow: r, dataStartRow: r + 1 };
  }
  return null;
}

const importDf = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });

  let wb;
  try {
    const ExcelJS = require('exceljs');
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' });
  }

  const projectSheets = wb.worksheets.filter(ws => ws.name !== 'TOTAL');
  if (projectSheets.length === 0) {
    return res.status(400).json({ message: 'TOTAL 시트 외 프로젝트 시트가 없습니다.' });
  }

  const typeCache    = {};
  const projectCache = {};
  const results      = [];
  let imported = 0;
  let failed   = 0;

  const existingTypes = await AssetProjectItemType.findAll();
  existingTypes.forEach(t => {
    const key = `${t.parent_id ?? 'ROOT'}::${t.name}`;
    typeCache[key] = t.id;
  });

  for (const ws of projectSheets) {
    const sheetName = ws.name;
    const detected  = detectDfColumns(ws);

    if (!detected) {
      results.push({ sheet: sheetName, status: 'skipped', reason: '헤더 감지 실패' });
      continue;
    }

    const { colMap, dataStartRow } = detected;

    if (!projectCache[sheetName]) {
      const [proj] = await AssetProject.findOrCreate({
        where:    { name: sheetName },
        defaults: { name: sheetName },
      });
      projectCache[sheetName] = proj.id;
    }
    const project_id = projectCache[sheetName];

    // carry-forward 대상 (serial_number 제외)
    const CARRY_COLS = [
      'manufacturer', 'parent_type', 'sub_type', 'model_name',
      'spec', 'acquisition_date', 'return_date', 'location',
      'remarks', 'owner_organization', 'equipment_number',
    ];
    const lastVals = {};

    for (let r = dataStartRow; r <= ws.rowCount; r++) {
      const getRaw = (key) => {
        if (!colMap[key]) return null;
        const cell = ws.getCell(r, colMap[key]);
        return cell.value instanceof Date ? cell.value : (cell.value != null ? String(cell.value).trim() : null);
      };

      // carry-forward 적용
      const row = {};
      for (const key of CARRY_COLS) {
        const raw = getRaw(key);
        const isDate = raw instanceof Date;
        const val = isDate ? raw : toVal(raw);
        if (val !== null) { lastVals[key] = raw; row[key] = val; }
        else              { row[key] = (lastVals[key] instanceof Date) ? lastVals[key] : toVal(lastVals[key] ?? null); }
      }
      row.serial_number = toVal(getRaw('serial_number'));

      // 완전히 빈 행 건너뜀
      if (!row.sub_type && !row.model_name && !row.manufacturer) continue;

      const typeName = row.sub_type || row.parent_type;
      if (!typeName) {
        results.push({ sheet: sheetName, row: r, status: 'failed', reason: '자산 분류 없음' });
        failed++; continue;
      }

      // parent_type findOrCreate
      let parentId = null;
      if (row.parent_type) {
        const parentKey = `ROOT::${row.parent_type}`;
        if (!typeCache[parentKey]) {
          const [pt] = await AssetProjectItemType.findOrCreate({
            where:    { name: row.parent_type, parent_id: null },
            defaults: { name: row.parent_type, parent_id: null },
          });
          typeCache[parentKey] = pt.id;
        }
        parentId = typeCache[parentKey];
      }

      // sub_type findOrCreate
      const subKey = `${parentId ?? 'ROOT'}::${typeName}`;
      if (!typeCache[subKey]) {
        const [st] = await AssetProjectItemType.findOrCreate({
          where:    { name: typeName, parent_id: parentId },
          defaults: { name: typeName, parent_id: parentId },
        });
        typeCache[subKey] = st.id;
      }
      const asset_type_id = typeCache[subKey];

      const acquisition_date = (row.acquisition_date instanceof Date)
        ? row.acquisition_date : parseDate(row.acquisition_date);
      const return_date = (row.return_date instanceof Date)
        ? row.return_date : parseDate(row.return_date);

      const t = await sequelize.transaction();
      try {
        const lastItem = await AssetProjectItem.findOne({
          where: { project_id },
          order: [['item_number', 'DESC']],
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        const item_number = lastItem ? lastItem.item_number + 1 : 1;

        const item = await AssetProjectItem.create({
          user_id:            req.user.userId,
          project_id,
          item_number,
          asset_type_id,
          owner_organization: colMap.owner_organization ? row.owner_organization : null,
          equipment_number:   colMap.equipment_number   ? row.equipment_number   : null,
          manufacturer:       row.manufacturer  || null,
          model_name:         row.model_name    || null,
          serial_number:      row.serial_number || null,
          spec:               row.spec          || null,
          acquisition_date:   acquisition_date  || null,
          return_date:        return_date        || null,
          state:              'in_use',
          location:           row.location      || null,
          remarks:            row.remarks        || null,
        }, { transaction: t });

        await AssetProjectHistory.create({
          asset_project_item_id: item.id,
          project_id,
          user_id:      req.user.userId,
          change_type:  'register',
          before_value: null,
          after_value:  'in_use',
        }, { transaction: t });

        await t.commit();
        results.push({ sheet: sheetName, row: r, status: 'success', item_id: item.id });
        imported++;
      } catch (err) {
        await t.rollback();
        results.push({ sheet: sheetName, row: r, status: 'failed', reason: err.message });
        failed++;
      }
    }
  }

  return res.status(200).json({
    message: `DF Import 완료: ${imported}건 성공, ${failed}건 실패`,
    imported, failed, results,
  });
};

// ─────────────────────────────────────────────────────────────
// DF 양식 다운로드
// ─────────────────────────────────────────────────────────────
const downloadDfTemplate = async (req, res) => {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');

  const HEADERS = [
    'No', '제조사', '대분류', '중분류', '모델명',
    '시리얼 넘버', '규격', '대여일', '반납일', '위치', '비고',
  ];
  const THIN = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  const FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD9E1F2' } };
  const COL_WIDTHS = [8, 14, 14, 14, 18, 20, 14, 14, 14, 16, 20];

  ws.getColumn(1).width = 4; // A열 여백
  HEADERS.forEach((h, i) => {
    ws.getColumn(i + 2).width = COL_WIDTHS[i];
    const cell = ws.getRow(1).getCell(i + 2);
    cell.value = h;
    cell.font  = { name: '맑은 고딕', size: 11, bold: true };
    cell.fill  = FILL;
    cell.border = THIN;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(1).height = 30;

  // 빈 데이터 행 1줄
  HEADERS.forEach((_, i) => {
    ws.getRow(2).getCell(i + 2).border = THIN;
  });
  ws.getRow(2).height = 25;

  res.setHeader('Content-Disposition', 'attachment; filename="DF_IMPORT_TEMPLATE.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await wb.xlsx.write(res);
  res.end();
};

// ─────────────────────────────────────────────────────────────
// SW 원본 IMPORT
// ─────────────────────────────────────────────────────────────
const importSwOriginal = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });

  let wb;
  try {
    const ExcelJS = require('exceljs');
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' });
  }

  const ws = wb.getWorksheet('SW LIST') || wb.worksheets[0];
  if (!ws) return res.status(400).json({ message: 'SW LIST 시트를 찾을 수 없습니다.' });

  // profile.name → user_id 캐시
  const profiles = await Profile.findAll({ include: [{ model: User, attributes: ['id'] }] });
  const nameToUserId = {};
  profiles.forEach(p => { if (p.name) nameToUserId[p.name.trim()] = p.user_id; });

  // 컬럼 인덱스 (1-indexed, row1 헤더 기준)
  // 번호(1) 제품명(2) 버전(3) 수량(4) 취득일자(5) 제품키(6) 키종류(7) 관련링크(8)
  // 제조사(9) 사용자(10) 사용자수량(11) 남은수량(12) 비고(13)
  const C = { name:2, ver:3, qty:4, acq:5, key:6, ktype:7, link:8, mfr:9, users:10, usedQty:11, remainQty:12, remarks:13 };

  const results = [];
  let imported  = 0;
  let failed    = 0;

  // carry-forward
  let lastName = null;
  let lastMfr  = null;

  for (let r = 2; r <= ws.rowCount; r++) {
    const g = (col) => {
      const v = ws.getCell(r, col).value;
      return v instanceof Date ? v : (v != null ? String(v).trim() : null);
    };

    const rawName    = g(C.name);
    const rawVer     = g(C.ver);
    const rawQty     = g(C.qty);
    const rawAcq     = g(C.acq);
    const rawKey     = g(C.key);   // '-' → null, null(빈셀) → 값 있음으로 판단
    const rawKtype   = g(C.ktype);
    const rawLink    = g(C.link);
    const rawMfr     = g(C.mfr);
    const rawUsers   = g(C.users);
    const rawUsedQty = g(C.usedQty);
    const rawRemain  = g(C.remainQty);
    const rawRemarks = g(C.remarks);

    // 의미 있는 값이 하나도 없으면 건너뜀
    const hasContent = [rawName, rawVer, rawQty, rawKey, rawKtype, rawMfr, rawUsers, rawRemain]
      .some(v => v !== null && v !== '-');
    if (!hasContent) continue;

    // 제품명 carry-forward (None = 앞 행 이름 사용)
    const name = toVal(rawName) ?? lastName;
    const mfr  = toVal(rawMfr)  ?? lastMfr;
    const ver  = toVal(rawVer);

    if (!name) {
      results.push({ row: r, status: 'skipped', reason: '제품명 carry-forward 불가' });
      continue;
    }

    lastName = name;
    lastMfr  = mfr ?? lastMfr;

    try {
      // ── asset_sw: name + version + manufacturer 조합으로 findOrCreate ──
      const swWhere = { name };
      if (ver) swWhere.version = ver;
      if (mfr) swWhere.manufacturer = mfr;

      const qty = (rawQty && rawQty !== '-') ? Number(rawQty) : 0;
      const [sw, swCreated] = await AssetSw.findOrCreate({
        where:    swWhere,
        defaults: {
          name,
          version:          ver  || null,
          manufacturer:     mfr  || null,
          quantity:         qty,
          acquisition_date: parseDate(rawAcq),
          state:            'available',
          remarks:          toVal(rawRemarks) || null,
        },
      });
      // 이미 존재하는 SW인데 이번 행에 수량이 있으면 덮어씀
      if (!swCreated && qty > 0) await sw.update({ quantity: qty });

      // ── 라이선스 파싱 ────────────────────────────────────────────────
      // 제품키: '-' → null(값 없음), null(빈셀) → null 저장하되 값 있다고 판단
      const licKey   = (rawKey === '-') ? null : (rawKey || null);
      const keyType  = rawKtype ? (KEY_TYPE_MAP[rawKtype] ?? null) : null;
      const relLink  = (rawLink === '-') ? null : (rawLink || null);

      // 사용자 파싱: 쉼표 구분, 공백 trim
      const userNames = rawUsers
        ? rawUsers.split(',').map(u => u.trim()).filter(u => u && u !== '-')
        : [];

      const usedQty  = (rawUsedQty && rawUsedQty !== '-') ? Number(rawUsedQty) : userNames.length;
      const remainQty = (rawRemain && rawRemain !== '-') ? Number(rawRemain) : 0;

      // 사용자명 → user_id 매핑
      const resolvedUserIds = userNames.map(uName =>
        isSpecialUser(uName) ? null : (nameToUserId[uName] ?? null)
      );

      // usedQty가 이름 수보다 많으면 나머지는 null로 채움
      while (resolvedUserIds.length < usedQty) resolvedUserIds.push(null);

      // in_use 라이선스 생성
      for (const userId of resolvedUserIds) {
        const lic = await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          userId,
          license_key:      licKey,
          license_password: null,
          key_type:         keyType,
          related_link:     relLink,
          state:            'in_use',
        });
        await AssetSwHistory.create({
          asset_sw_id:  sw.id,
          license_id:   lic.id,
          user_id:      userId,
          change_type:  'register',
          before_value: null,
          after_value:  'in_use',
        });
      }

      // available 라이선스 생성 (남은 수량)
      for (let i = 0; i < remainQty; i++) {
        await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          null,
          license_key:      null,
          license_password: null,
          key_type:         keyType,
          related_link:     relLink,
          state:            'available',
        });
      }

      // asset_sw.state 갱신
      const inUseCount = await AssetSwLicense.count({ where: { asset_sw_id: sw.id, state: 'in_use' } });
      await sw.update({ state: inUseCount > 0 ? 'in_use' : 'available' });

      results.push({ row: r, status: 'success', sw_id: sw.id, created: swCreated, name, ver });
      imported++;
    } catch (err) {
      results.push({ row: r, status: 'failed', reason: err.message });
      failed++;
    }
  }

  return res.status(200).json({
    message: `SW Import 완료: ${imported}건 성공, ${failed}건 실패`,
    imported, failed, results,
  });
};

// ─────────────────────────────────────────────────────────────
// Enterprise 원본 IMPORT
// ─────────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  '사무': 'office',
  '가구': 'furniture',
  '산업': 'industrial',
  '전통': 'industrial',
  '전기': 'electrical',
};

function parseAssetNumber(assetNumber) {
  if (!assetNumber) return null;
  const parts = String(assetNumber).trim().split('-');
  if (parts.length < 3) return null;
  const category = CATEGORY_MAP[parts[0]] ?? null;
  const code      = parts[1];
  if (!category || !code) return null;
  return { category, code };
}

function resolveResponsibleType(location, nameToUserId) {
  if (!location || location === '-') return 'vacant';
  const s = location.trim();
  if (s === '공석') return 'vacant';
  if (s === '공용') return 'shared';
  if (nameToUserId[s] !== undefined) return 'personal';
  return 'place';
}

const importEnterpriseOriginal = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });

  let wb;
  try {
    const ExcelJS = require('exceljs');
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' });
  }

  const ws = wb.getWorksheet('Rawdata') || wb.worksheets[0];
  if (!ws) return res.status(400).json({ message: 'Rawdata 시트를 찾을 수 없습니다.' });

  // 헤더: 자산번호(1) 소관부서(2) 사용위치(3) 취득일자(4) 제조사(5) 분류(6) 규격(7) 일련번호(8) 비고(9)
  const C = { assetNum:1, dept:2, location:3, acq:4, mfr:5, typeName:6, spec:7, serial:8, remarks:9 };

  // profile.name → user_id 캐시
  const profiles = await Profile.findAll({ include: [{ model: User, attributes: ['id'] }] });
  const nameToUserId = {};
  profiles.forEach(p => { if (p.name) nameToUserId[p.name.trim()] = p.user_id; });

  const catCache  = {}; // categoryName → id
  const typeCache = {}; // 'categoryId::code' → { id, name }
  const deptCache = {}; // deptName → id

  const results = [];
  let imported  = 0;
  let failed    = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const g = (col) => {
      const v = ws.getCell(r, col).value;
      return v instanceof Date ? v : (v != null ? String(v).trim() : null);
    };

    const assetNumber  = toVal(g(C.assetNum));
    const deptName     = toVal(g(C.dept));
    const locationRaw  = toVal(g(C.location));
    const acqRaw       = g(C.acq);
    const manufacturer = toVal(g(C.mfr));
    const typeName     = toVal(g(C.typeName));
    const spec         = toVal(g(C.spec));
    const serial       = toVal(g(C.serial));
    const remarks      = toVal(g(C.remarks));

    if (!assetNumber && !typeName) continue;

    // asset_number가 null인 행은 건너뜀
    if (!assetNumber) {
      results.push({ row: r, status: 'skipped', reason: 'asset_number 없음' });
      continue;
    }

    const parsed = parseAssetNumber(assetNumber);
    if (!parsed) {
      results.push({ row: r, status: 'failed', reason: `asset_number 파싱 실패: ${assetNumber}` });
      failed++; continue;
    }
    const { category: catName, code } = parsed;

    try {
      // category findOrCreate
      if (!catCache[catName]) {
        const [cat] = await AssetEnterpriseCategory.findOrCreate({
          where: { name: catName }, defaults: { name: catName },
        });
        catCache[catName] = cat.id;
      }
      const category_id = catCache[catName];

      // item_type: category_id + code 조합으로 findOrCreate
      // 동일 code 내 다른 분류명이 올 수 있어 name도 관리
      const typeKey = `${category_id}::${code}`;
      if (!typeCache[typeKey]) {
        const [itemType] = await AssetEnterpriseItemType.findOrCreate({
          where:    { category_id, code },
          defaults: { category_id, code, name: typeName || code },
        });
        // 최초 생성 이후 name 업데이트 (더 정확한 이름이 들어올 경우 대비)
        if (typeName && itemType.name !== typeName) {
          await itemType.update({ name: typeName });
        }
        typeCache[typeKey] = itemType.id;
      }
      const item_type_id = typeCache[typeKey];

      // department findOrCreate
      let department_id = null;
      if (deptName) {
        if (!deptCache[deptName]) {
          const [dept] = await Department.findOrCreate({
            where: { name: deptName }, defaults: { name: deptName },
          });
          deptCache[deptName] = dept.id;
        }
        department_id = deptCache[deptName];
      }

      // responsible_type / user_id 결정
      const responsibleType  = resolveResponsibleType(locationRaw, nameToUserId);
      const userId           = responsibleType === 'personal' ? (nameToUserId[locationRaw?.trim()] ?? null) : null;
      const responsibleValue = (responsibleType === 'place' || responsibleType === 'shared') ? locationRaw
        : responsibleType === 'personal' ? locationRaw
        : null;

      const asset = await AssetEnterprise.create({
        asset_number:      assetNumber,
        category_id,
        item_type_id,
        department_id,
        responsible_type:  responsibleType,
        user_id:           userId,
        responsible_value: responsibleValue,
        state:             'in_use',
        acquisition_date:  parseDate(acqRaw) || null,
        manufacturer:      manufacturer || null,
        spec:              spec         || null,
        serial_number:     serial       || null,
        location:          locationRaw  || null,
        remarks:           remarks      || null,
      });

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id:             req.user.userId,
        change_type:         'register',
        before_value:        null,
        after_value:         'in_use',
      });

      results.push({ row: r, status: 'success', asset_id: asset.id, asset_number: assetNumber });
      imported++;
    } catch (err) {
      results.push({ row: r, status: 'failed', reason: err.message, asset_number: assetNumber });
      failed++;
    }
  }

  return res.status(200).json({
    message: `Enterprise Import 완료: ${imported}건 성공, ${failed}건 실패`,
    imported, failed, results,
  });
};

module.exports = {
  importDf,
  downloadDfTemplate,
  importSwOriginal,
  importEnterpriseOriginal,
};