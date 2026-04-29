'use strict';
 
const ExcelJS = require('exceljs');
const XLSX    = require('xlsx');
 
const sequelize = require('../config/db');
const {
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
  AssetSw, AssetSwLicense, AssetSwHistory,
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseHistory, Department, Profile, User,
} = require('../models');
 
// ─────────────────────────────────────────────────────────────────
// 공통 유틸 (기존 그대로)
// ─────────────────────────────────────────────────────────────────
function toVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return (s === '' || s === '-' || s.toLowerCase() === 'n/a') ? null : s;
}
 
function toSerialVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  if (s.toLowerCase() === 'n/a' || s === '확인불가') return '확인불가';
  return s;
}
 
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s || s === '-') return null;
  const d = new Date(s.replace(/\./g, '-'));
  return isNaN(d.getTime()) ? null : d;
}
 
function readCell(ws, r, col) {
  if (!col) return null;
  const v = ws.getCell(r, col).value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') return (v.hyperlink || v.text || '').trim() || null;
  return String(v).trim();
}
 
function readXlsxCell(row, col) {
  const v = row[col];
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  return s === '' ? null : s;
}
 
async function loadExcel(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file.buffer);
  return wb;
}
 
const KEY_TYPE_MAP    = { '시리얼': 'serial', '크레덴셜': 'credential' };
const SPECIAL_USER_RE = /sdoe|공용|관리자/i;
const SDOE_RE         = /^sdoe\s*(\d+)?대?$/i;
 
function isSpecialUser(name) {
  return SPECIAL_USER_RE.test(name.trim());
}
 
// ─────────────────────────────────────────────────────────────────
// DF IMPORT
// ─────────────────────────────────────────────────────────────────
 
// QTY 파싱: null / '' / '-' / 'n/a' → null, 양수 정수 → 그대로, 0 이하 → null
function parseQty(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'n/a') return null;
  const n = parseInt(s, 10);
  return (isNaN(n) || n <= 0) ? null : n;
}
 
// 일반 필드 변환: null / '' / '-' → null, 'n/a' → '확인불가'
function toFieldVal(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  if (s.toLowerCase() === 'n/a') return '확인불가';
  return s;
}
 
// PC 헤더 키워드 매핑
const PC_KEYWORD_MAP = {
  item:             ['item'],
  dusan_item_no:    ['두산 item no', '두산 item no.', '두산item no'],
  manufacturer:     ['manufacturer', '제조사'],
  product_name:     ['product name', 'productname', 'product_name'],
  model_number:     ['model number', 'model no', 'modelnumber', 'model_number'],
  serial_number:    ['serial number', 'serial no', 'serialnumber', 'serial_number'],
  quantity:         ['qty'],
  acquisition_date: ['rental_date', '대여일', '취득일', '취득일자'],
  return_date:      ['return_date', '반납일'],
  remarks:          ['remark', 'remarks', '비고'],
};
 
// PLC 헤더 키워드 매핑
const PLC_KEYWORD_MAP = {
  item:             ['item'],
  serial_number:    ['serial number', 'serial no', 'serialnumber', 'serial_number'],
  quantity:         ['qty'],
  acquisition_date: ['rental_date', '대여일', '취득일', '취득일자'],
  return_date:      ['return_date', '반납일'],
  remarks:          ['remark', 'remarks', '비고'],
};
 
function detectDfColumns(ws) {
  for (let r = 1; r <= 10; r++) {
    const row = [];
    for (let c = 1; c <= 25; c++) {
      const v = ws.getCell(r, c).value;
      row.push(v != null ? String(v).trim() : '');
    }
 
    // 'Item' 키워드가 있는 행을 헤더로 판단
    const rowLower = row.map(v => v.toLowerCase());
    const hasItem  = rowLower.some(v => v === 'item');
    if (!hasItem) continue;
 
    // PC vs PLC 판별: 'Model Number' 또는 'Product Name' 존재 여부
    const isPC      = rowLower.some(v => v === 'model number' || v === 'product name');
    const sheetType = isPC ? 'PC' : 'PLC';
    const KEYWORD_MAP = isPC ? PC_KEYWORD_MAP : PLC_KEYWORD_MAP;
 
    const colMap = {};
    for (const [key, keywords] of Object.entries(KEYWORD_MAP)) {
      colMap[key] = null;
      for (let c = 0; c < rowLower.length; c++) {
        if (keywords.some(kw => rowLower[c] === kw)) {
          colMap[key] = c + 1;
          break;
        }
      }
    }
 
    return { colMap, dataStartRow: r + 1, sheetType };
  }
  return null;
}
 
const importDf = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
 
  let wb;
  try { wb = await loadExcel(req.file); }
  catch { return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' }); }
 
  const projectSheets = wb.worksheets.filter(ws => ws.name !== 'TOTAL');
  if (!projectSheets.length) return res.status(400).json({ message: 'TOTAL 시트 외 프로젝트 시트가 없습니다.' });
 
  const typeCache    = {};
  const projectCache = {};
  const results      = [];
  let imported = 0, failed = 0;
 
  const existingTypes = await AssetProjectItemType.findAll();
  existingTypes.forEach(t => { typeCache[`${t.parent_id ?? 'ROOT'}::${t.name}`] = t.id; });
 
  for (const ws of projectSheets) {
    const detected = detectDfColumns(ws);
    if (!detected) {
      results.push({ sheet: ws.name, status: 'skipped', reason: '헤더 감지 실패' });
      continue;
    }
    const { colMap, dataStartRow, sheetType } = detected;
 
    if (!projectCache[ws.name]) {
      const [proj] = await AssetProject.findOrCreate({ where: { name: ws.name }, defaults: { name: ws.name } });
      projectCache[ws.name] = proj.id;
    }
    const project_id = projectCache[ws.name];
 
    // Carry-forward 대상 필드 (sheetType에 따라 분기)
    const CARRY_FIELDS = sheetType === 'PC'

      ? ['item', 'manufacturer', 'dusan_item_no', 'product_name', 'model_number', 'acquisition_date']
      : ['item', 'acquisition_date'];
    const last = {};
    const g = (r, key) => readCell(ws, r, colMap[key]);
 
    for (let r = dataStartRow; r <= ws.rowCount; r++) {
 
      // ── 빈 행 스킵 ────────────────────────────────────────────
      // item, model_number, manufacturer, product_name, serial_number, quantity, acquisition_date
      // 모두 비어있으면 스킵
      const chkItem    = toFieldVal(g(r, 'item'));
      const chkModel   = sheetType === 'PC' ? toFieldVal(g(r, 'model_number'))  : null;
      const chkMfr     = sheetType === 'PC' ? toFieldVal(g(r, 'manufacturer'))  : null;
      const chkProduct = sheetType === 'PC' ? toFieldVal(g(r, 'product_name'))  : null;
      const chkSerial  = toFieldVal(g(r, 'serial_number'));
      const chkQty     = parseQty(g(r, 'quantity'));
      const chkAcq     = g(r, 'acquisition_date');
 
      // 모든 셀이 비어있으면 데이터 끝으로 판단 → 다음 시트로
      const isAllEmpty = !chkItem && !chkModel && !chkMfr && !chkProduct && !chkSerial && chkQty === null && !chkAcq
        && !toFieldVal(g(r, 'return_date')) && !toFieldVal(g(r, 'remarks'));
      if (isAllEmpty) break;
 
      // ── Carry-forward 처리 ────────────────────────────────────
      const row = {};
      for (const key of CARRY_FIELDS) {
        const raw = g(r, key);
        const val = raw instanceof Date ? raw : toFieldVal(raw);
        if (val !== null) { last[key] = raw; row[key] = val; }
        else { row[key] = last[key] instanceof Date ? last[key] : toFieldVal(last[key] ?? null); }
      }
 
      // Carry-forward 비대상 필드 직접 읽기
      row.serial_number = toFieldVal(g(r, 'serial_number'));
      row.quantity      = parseQty(g(r, 'quantity'));
      row.remarks       = toFieldVal(g(r, 'remarks'));
 
      // acquisition_date / return_date: carry-forward 결과가 있으면 사용, 없으면 현재 행 직접 읽기
      if (!row.acquisition_date) row.acquisition_date = g(r, 'acquisition_date');
      if (!row.return_date)      row.return_date      = g(r, 'return_date');
 
      // ── 두산 Item No 처리 (PC 전용) ───────────────────────────
      // colMap에 dusan_item_no가 존재하면 owner_organization = '두산' 고정,
      // equipment_number = 두산 Item No 셀 값
      let ownerOrg     = null;
      let equipmentNum = null;
      if (sheetType === 'PC' && colMap.dusan_item_no) {
        const dusanVal = typeof row.dusan_item_no === 'string' ? row.dusan_item_no : null;
        if (dusanVal) {
          ownerOrg     = '두산';
          equipmentNum = dusanVal;
        }
      }
 
      // ── 대분류(parent_type) = PC / PLC 자동 결정 ─────────────
      const parentTypeName = sheetType;
      const pk = `ROOT::${parentTypeName}`;
      if (!typeCache[pk]) {
        const [pt] = await AssetProjectItemType.findOrCreate({
          where:    { name: parentTypeName, parent_id: null },
          defaults: { name: parentTypeName, parent_id: null },
        });
        typeCache[pk] = pt.id;
      }
      const parentId = typeCache[pk];
 
      // ── 중분류(sub_type) = Item 컬럼 값
      // Item 값이 없으면 asset_type_id = null (중분류 미지정)
      const subTypeName = typeof row.item === 'string' ? row.item : null;
      let assetTypeId = null;
      if (subTypeName) {
        const sk = `${parentId}::${subTypeName}`;
        if (!typeCache[sk]) {
          const [st] = await AssetProjectItemType.findOrCreate({
            where:    { name: subTypeName, parent_id: parentId },
            defaults: { name: subTypeName, parent_id: parentId },
          });
          typeCache[sk] = st.id;
        }
        assetTypeId = typeCache[sk];
      }
 
      const acqDate = row.acquisition_date instanceof Date ? row.acquisition_date : parseDate(row.acquisition_date);
      const retDate = row.return_date      instanceof Date ? row.return_date      : parseDate(row.return_date);
      const state   = retDate ? 'returned' : 'in_use';
 
      const t = await sequelize.transaction();
      try {
        const lastItem = await AssetProjectItem.findOne({
          where: { project_id }, order: [['item_number', 'DESC']],
          lock: t.LOCK.UPDATE, transaction: t,
        });
 
        const item = await AssetProjectItem.create({
          user_id:            req.user.userId,
          project_id,
          item_number:        (lastItem?.item_number ?? 0) + 1,
          asset_type_id:      assetTypeId,
          owner_organization: ownerOrg,
          equipment_number:   equipmentNum,
          manufacturer:       sheetType === 'PC' ? (row.manufacturer  || null) : null,
          product_name:       sheetType === 'PC' ? (row.product_name  || null) : null,
          model_number:       sheetType === 'PC' ? (row.model_number  || null) : null,
          serial_number:      row.serial_number  || null,
          quantity:           row.quantity,
          acquisition_date:   acqDate            || null,
          return_date:        retDate            || null,
          state,
          location:           null,
          remarks:            row.remarks        || null,
        }, { transaction: t });
 
        await AssetProjectHistory.create({
          asset_project_item_id: item.id, project_id,
          user_id: req.user.userId, change_type: 'register',
          before_value: null, after_value: state,
        }, { transaction: t });
 
        await t.commit();
        results.push({ sheet: ws.name, row: r, status: 'success', item_id: item.id });
        imported++;
      } catch (err) {
        await t.rollback();
        results.push({ sheet: ws.name, row: r, status: 'failed', reason: err.message });
        failed++;
      }
    }
  }
 
  return res.status(200).json({ message: `DF Import 완료: ${imported}건 성공, ${failed}건 실패`, imported, failed, results });
};
 
// ─────────────────────────────────────────────────────────────────
// DF 양식 다운로드 (PC / PLC 시트 분리)
// 구조: 타이틀(시트명) → 컬럼명 → 빈 데이터 행 1줄
// ─────────────────────────────────────────────────────────────────
const TMPL_THIN  = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
const TMPL_TITLE_FILL  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1F3864' } };
const TMPL_HEADER_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD9E1F2' } };
const TMPL_FONT_BASE   = { name:'맑은 고딕', size:11 };
const TMPL_FONT_HEADER = { name:'맑은 고딕', size:11, bold:true };
const TMPL_FONT_TITLE  = { name:'맑은 고딕', size:12, bold:true, color:{ argb:'FFFFFFFF' } };
 
const TMPL_SHEETS = [
  {
    name:      'PC',
    headers:   ['No', 'Item', '두산 Item No', 'Manufacturer', 'Product Name', 'Model Number', 'Serial Number', 'QTY', '대여일', '반납일', '비고'],
    colWidths: [8, 16, 16, 16, 22, 20, 22, 8, 14, 14, 20],
  },
  {
    name:      'PLC',
    headers:   ['No', 'Item', 'Serial Number', 'QTY', '대여일', '반납일', '비고'],
    colWidths: [8, 16, 22, 8, 14, 14, 20],
  },
];
 
const downloadDfTemplate = async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TAMS';
 
  for (const { name, headers, colWidths } of TMPL_SHEETS) {
    const ws      = wb.addWorksheet(name);
    const lastCol = headers.length + 2 - 1; // col 2 ~ lastCol
 
    ws.getColumn(1).width = 4;
    headers.forEach((_, i) => { ws.getColumn(i + 2).width = colWidths[i]; });
 
    // Row 1: 타이틀 (시트명 병합)
    ws.mergeCells(1, 2, 1, lastCol);
    const titleCell     = ws.getRow(1).getCell(2);
    titleCell.value     = name;
    titleCell.font      = TMPL_FONT_TITLE;
    titleCell.fill      = TMPL_TITLE_FILL;
    titleCell.border    = TMPL_THIN;
    titleCell.alignment = { horizontal:'center', vertical:'middle' };
    ws.getRow(1).height = 28;
 
    // Row 2: 컬럼명
    headers.forEach((h, i) => {
      const cell     = ws.getRow(2).getCell(i + 2);
      cell.value     = h;
      cell.font      = TMPL_FONT_HEADER;
      cell.fill      = TMPL_HEADER_FILL;
      cell.border    = TMPL_THIN;
      cell.alignment = { horizontal:'center', vertical:'middle' };
    });
    ws.getRow(2).height = 30;
 
    // Row 3: 빈 데이터 행 (테두리만)
    headers.forEach((_, i) => {
      ws.getRow(3).getCell(i + 2).border = TMPL_THIN;
    });
    ws.getRow(3).height = 25;
  }
 
  res.setHeader('Content-Disposition', 'attachment; filename="DF_IMPORT_TEMPLATE.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await wb.xlsx.write(res);
  res.end();
};
 
// ─────────────────────────────────────────────────────────────────
// SW 원본 IMPORT
// ─────────────────────────────────────────────────────────────────
// 변경 사항:
//   - 일반 사용자 라이선스 → license_type: 'per_seat'
//   - SDOE 라이선스 (동일 키 여러 레코드) → license_type: 'shared'
// ─────────────────────────────────────────────────────────────────
const SW_COL = { num:0, name:1, ver:2, qty:3, issue_date:4, key:5, ktype:6, link:7, mfr:8, users:9, remarks:12 };
 
const importSwOriginal = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
 
  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets['SW LIST'] || wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  } catch {
    return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' });
  }
 
  const profiles = await Profile.findAll({ include: [{ model: User, attributes: ['id'] }] });
  const nameToUserId = {};
  profiles.forEach(p => { if (p.name) nameToUserId[p.name.trim()] = p.user_id; });
 
  const results = [];
  let imported = 0, failed = 0;
  let lastSwId = null;
  let lastName = null, lastMfr = null, lastVer = null, lastKeyType = null;
 
  const g = (row, col) => readXlsxCell(row, col);
 
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const r   = i + 1;
 
    const rawNum     = g(row, SW_COL.num);
    const rawName    = g(row, SW_COL.name);
    const rawVer     = g(row, SW_COL.ver);
    const rawQty     = g(row, SW_COL.qty);
    const rawIssue   = g(row, SW_COL.issue_date);
    const rawKey     = g(row, SW_COL.key);
    const rawKtype   = g(row, SW_COL.ktype);
    const rawLink    = g(row, SW_COL.link);
    const rawMfr     = g(row, SW_COL.mfr);
    const rawUsers   = g(row, SW_COL.users);
    const rawRemarks = g(row, SW_COL.remarks);
 
    if (!rawNum && !rawName && !rawKey && !rawUsers?.trim()) continue;
 
    const isNewSw = rawNum !== null;
 
    const name = toVal(rawName) ?? lastName;
    const mfr  = toVal(rawMfr)  ?? lastMfr;
    const ver     = isNewSw ? toVal(rawVer) : (toVal(rawVer) ?? lastVer);
    const keyType = isNewSw
      ? (rawKtype ? (KEY_TYPE_MAP[rawKtype] ?? null) : null)
      : ((rawKtype ? (KEY_TYPE_MAP[rawKtype] ?? null) : null) ?? lastKeyType);
 
    const relLink = (rawLink === '-') ? null : toVal(rawLink);
 
    if (!name) {
      results.push({ row: r, status: 'skipped', reason: '제품명 carry-forward 불가' });
      continue;
    }
 
    lastName    = name;
    lastVer     = ver     ?? lastVer;
    lastMfr     = mfr     ?? lastMfr;
    lastKeyType = keyType ?? lastKeyType;
 
    try {
      let sw;
      if (isNewSw) {
        sw = await AssetSw.create({
          name,
          version:          ver     || null,
          manufacturer:     mfr     || null,
          quantity:         0,                  // 라이선스 생성 시 +1 처리하므로 0 시작
          acquisition_date: null,
          license_required: true,               // 원본 데이터는 모두 라이선스형
          related_link:     relLink || null,    // 기존 relLink 변수 활용
          state:            'available',
          remarks:          toVal(rawRemarks) || null,
        });
        lastSwId = sw.id;
      } else {
        if (!lastSwId) {
          results.push({ row: r, status: 'skipped', reason: '연결할 SW 없음' });
          continue;
        }
        sw = await AssetSw.findByPk(lastSwId);
      }
 
      if (rawKey === '-') {
        results.push({ row: r, status: 'skipped', reason: '라이선스 키 없음 (-)' });
        continue;
      }
 
      let licKey, licPassword;
      if (keyType === 'credential' && rawKey) {
        const sepIdx = rawKey.indexOf(',');
        if (sepIdx !== -1) {
          licKey      = rawKey.slice(0, sepIdx).trim() || null;
          licPassword = rawKey.slice(sepIdx + 1).trim() || null;
        } else {
          licKey      = rawKey || null;
          licPassword = null;
        }
      } else {
        licKey      = rawKey || null;
        licPassword = null;
      }
 
      const issueDate = rawIssue instanceof Date ? rawIssue : parseDate(rawIssue);
 
      let sdoeCount = 0;
      const userNames = rawUsers
        ? rawUsers.split(',').map(u => u.trim()).filter(u => u && u !== '-').filter(u => {
            const m = u.match(SDOE_RE);
            if (m) { sdoeCount += m[1] ? Number(m[1]) : 1; return false; }
            return true;
          })
        : [];
 
      // 일반 사용자 라이선스 → per_seat
      for (const uName of userNames) {
        const isSpecial = isSpecialUser(uName);
        const userId    = isSpecial ? null : (nameToUserId[uName] ?? null);
        const lic = await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          userId,
          license_key:      licKey,
          license_password: licPassword,
          key_type:         keyType,
          license_type:     'per_seat',
          issue_date:       issueDate,
          state:            'in_use',
        });
        await AssetSwHistory.create({
          asset_sw_id: sw.id, license_id: lic.id,
          user_id: userId, change_type: 'register',
          before_value: null, after_value: 'in_use',
        });
        await sw.increment('quantity', { by: 1 }); // 라이선스 1개 → quantity +1
      }
 
      // 사용자도 SDOE도 없음 → available, per_seat
      if (userNames.length === 0 && sdoeCount === 0) {
        await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          null,
          license_key:      licKey,
          license_password: licPassword,
          key_type:         keyType,
          license_type:     'per_seat',
          issue_date:       issueDate,
          state:            'available',
        });
        await sw.increment('quantity', { by: 1 }); // quantity +1
      }
 
      // SDOE N대 → shared
      for (let s = 0; s < sdoeCount; s++) {
        const lic = await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          null,
          license_key:      licKey,
          license_password: licPassword,
          key_type:         keyType,
          license_type:     'shared',
          issue_date:       issueDate,
          state:            'in_use',
        });
        await AssetSwHistory.create({
          asset_sw_id: sw.id, license_id: lic.id,
          user_id: null, change_type: 'register',
          before_value: null, after_value: 'in_use',
        });
        await sw.increment('quantity', { by: 1 }); // quantity +1
      }
 
      const inUseCount = await AssetSwLicense.count({ where: { asset_sw_id: sw.id, state: 'in_use' } });
      await sw.update({ state: inUseCount > 0 ? 'in_use' : 'available' });
 
      results.push({ row: r, status: 'success', sw_id: sw.id, new_sw: isNewSw, name, ver });
      imported++;
    } catch (err) {
      results.push({ row: r, status: 'failed', reason: err.message });
      failed++;
    }
  }
 
  return res.status(200).json({ message: `SW Import 완료: ${imported}건 성공, ${failed}건 실패`, imported, failed, results });
};
 
// ─────────────────────────────────────────────────────────────────
// Enterprise 원본 IMPORT (기존 그대로)
// ─────────────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  '사무': 'office', '가구': 'furniture',
  '산업': 'industrial', '전통': 'industrial', '전기': 'electrical',
};
 
function parseAssetNumber(assetNumber) {
  const parts = String(assetNumber).trim().split('-');
  if (parts.length < 3) return null;
  const category = CATEGORY_MAP[parts[0]] ?? null;
  const code      = parts[1];
  return (category && code) ? { category, code } : null;
}
 
function resolveResponsible(location, nameToUserId) {
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
  try { wb = await loadExcel(req.file); }
  catch { return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' }); }
 
  const ws = wb.getWorksheet('Rawdata') || wb.worksheets[0];
  if (!ws) return res.status(400).json({ message: 'Rawdata 시트를 찾을 수 없습니다.' });
 
  const C = { assetNum:1, dept:2, location:3, acq:4, mfr:5, typeName:6, spec:7, serial:8, remarks:9 };
 
  const profiles = await Profile.findAll({ include: [{ model: User, attributes: ['id'] }] });
  const nameToUserId = {};
  const nameToDeptId = {};
  profiles.forEach(p => {
    if (p.name) {
      nameToUserId[p.name.trim()] = p.user_id;
      if (p.department_id) nameToDeptId[p.name.trim()] = p.department_id;
    }
  });
 
  const catCache  = {};
  const typeCache = {};
  const deptCache = {};
  const results   = [];
  let imported = 0, failed = 0;
 
  const g = (r, col) => readCell(ws, r, col);
 
  for (let r = 2; r <= ws.rowCount; r++) {
    const assetNumber = toVal(g(r, C.assetNum));
    const deptName    = toVal(g(r, C.dept));
    const location    = toVal(g(r, C.location));
    const typeName    = toVal(g(r, C.typeName));
 
    if (!assetNumber) {
      if (typeName) results.push({ row: r, status: 'skipped', reason: 'asset_number 없음' });
      continue;
    }
 
    const parsed = parseAssetNumber(assetNumber);
    if (!parsed) {
      results.push({ row: r, status: 'failed', reason: `asset_number 파싱 실패: ${assetNumber}` });
      failed++; continue;
    }
    const { category: catName, code } = parsed;
 
    try {
      if (!catCache[catName]) {
        const [cat] = await AssetEnterpriseCategory.findOrCreate({ where: { name: catName }, defaults: { name: catName } });
        catCache[catName] = cat.id;
      }
      const category_id = catCache[catName];
 
      const resolvedName = typeName || code;
      const typeKey = `${category_id}::${code}::${resolvedName}`;
      if (!typeCache[typeKey]) {
        const [itemType] = await AssetEnterpriseItemType.findOrCreate({
          where:    { category_id, code, name: resolvedName },
          defaults: { category_id, code, name: resolvedName },
        });
        typeCache[typeKey] = itemType.id;
      }
 
      const responsibleType = resolveResponsible(location, nameToUserId);
      const userId = responsibleType === 'personal' ? (nameToUserId[location?.trim()] ?? null) : null;
 
      let department_id = null;
      if (responsibleType === 'personal' && location && nameToDeptId[location.trim()]) {
        department_id = nameToDeptId[location.trim()];
      } else if (deptName) {
        if (!deptCache[deptName]) {
          const [dept] = await Department.findOrCreate({ where: { name: deptName }, defaults: { name: deptName } });
          deptCache[deptName] = dept.id;
        }
        department_id = deptCache[deptName];
      }
 
      const asset = await AssetEnterprise.create({
      category_id,
      item_type_id:      typeCache[typeKey],
      department_id,
      responsible_type:  responsibleType,
      user_id:           userId,
      state:             responsibleType === 'vacant' ? 'stored' : 'in_use',
      acquisition_date:  parseDate(g(r, C.acq)) || null,
      manufacturer:      toVal(g(r, C.mfr))     || null,
      spec:              toVal(g(r, C.spec))     || null,
      serial_number:     toVal(g(r, C.serial))   || null,
      location:          location                || null,
      remarks:           toVal(g(r, C.remarks))  || null,
    });
 
      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id: req.user.userId,
        change_type: 'register', before_value: null, after_value: 'in_use',
      });
 
      results.push({ row: r, status: 'success', asset_id: asset.id });
      imported++;
    } catch (err) {
      results.push({ row: r, status: 'failed', reason: err.message });
      failed++;
    }
  }
 
  return res.status(200).json({ message: `Enterprise Import 완료: ${imported}건 성공, ${failed}건 실패`, imported, failed, results });
};
 
module.exports = { importDf, downloadDfTemplate, importSwOriginal, importEnterpriseOriginal };