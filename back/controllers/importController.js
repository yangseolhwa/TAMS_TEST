'use strict';
 
const ExcelJS = require('exceljs');
const XLSX    = require('xlsx');
const { Op }  = require('sequelize');
const { PLC_ITEM_KEYWORDS } = require('../config/dfConfig');
const { recalcSwState }     = require('../utils/swStateHelper');
const sequelize = require('../config/db');
const {
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
  AssetSw, AssetSwLicense, AssetSwHistory,
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseHistory, Department, Profile, User,
} = require('../models');
 
// ─────────────────────────────────────────────────────────────────
// 공통 유틸
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
 
function isMergedSlave(ws, r, col) {
  if (!col) return false;
  return ws.getCell(r, col).type === 1;
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
function parseQty(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'n/a') return null;
  const n = parseInt(s, 10);
  return (isNaN(n) || n <= 0) ? null : n;
}
 
function toFieldVal(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  if (s.toLowerCase() === 'n/a') return '확인불가';
  return s;
}
 
const PC_KEYWORD_MAP = {
  item:             ['item'],
  manufacturer:     ['manufacturer', '제조사'],
  product_name:     ['product name', 'productname', 'product_name'],
  model_number:     ['model number', 'model no', 'modelnumber', 'model_number'],
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

    const rowLower = row.map(v => v.toLowerCase());
    const hasItem  = rowLower.some(v => v === 'item');
    if (!hasItem) continue;

    const colMap = {};
    for (const [key, keywords] of Object.entries(PC_KEYWORD_MAP)) {
      colMap[key] = null;
      for (let c = 0; c < rowLower.length; c++) {
        if (keywords.some(kw => rowLower[c] === kw)) {
          colMap[key] = c + 1;
          break;
        }
      }
    }

    const dataStartRow = r + 1;

    let sheetType = 'PC';
    if (colMap.item) {
      for (let dr = dataStartRow; dr <= ws.rowCount; dr++) {
        const raw = ws.getCell(dr, colMap.item).value;
        if (raw == null) continue;
        const itemStr = String(raw).trim();
        if (PLC_ITEM_KEYWORDS.has(itemStr)) {
          sheetType = 'PLC';
          break;
        }
      }
    }

    // '* Item No' 패턴 컬럼 동적 감지 (두산, KAERI 등 조직명 자동 추출)
    const OWNER_ITEM_NO_RE = /^(.+?)\s*item\s+no\.?$/i;
    let ownerOrgName = null;
    for (let c = 0; c < row.length; c++) {
      const match = row[c].match(OWNER_ITEM_NO_RE);
      if (match) {
        colMap.owner_item_no = c + 1;
        ownerOrgName = match[1];
        break;
      }
    }

    return { colMap, dataStartRow, sheetType, ownerOrgName };
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
    const { colMap, dataStartRow, sheetType, ownerOrgName } = detected;

    if (!projectCache[ws.name]) {
      const [proj] = await AssetProject.findOrCreate({
        where: { name: ws.name }, defaults: { name: ws.name },
      });
      projectCache[ws.name] = proj.id;
    }
    const project_id = projectCache[ws.name];

    const CARRY_FIELDS = [
      'item', 'manufacturer', 'owner_item_no',
      'product_name', 'model_number', 'acquisition_date',
    ];
    const last = {};
    const g = (r, key) => readCell(ws, r, colMap[key]);

    for (let r = dataStartRow; r <= ws.rowCount; r++) {
      const chkItem    = toFieldVal(g(r, 'item'));
      const chkModel   = toFieldVal(g(r, 'model_number'));
      const chkMfr     = toFieldVal(g(r, 'manufacturer'));
      const chkProduct = toFieldVal(g(r, 'product_name'));
      const chkSerial  = toFieldVal(g(r, 'serial_number'));
      const chkQty     = parseQty(g(r, 'quantity'));
      const chkAcq     = g(r, 'acquisition_date');

      const isAllEmpty = !chkItem && !chkModel && !chkMfr && !chkProduct
        && !chkSerial && chkQty === null && !chkAcq
        && !toFieldVal(g(r, 'return_date')) && !toFieldVal(g(r, 'remarks'));
      if (isAllEmpty) break;

      const row = {};
      for (const key of CARRY_FIELDS) {
        const raw = g(r, key);
        const val = raw instanceof Date ? raw : toFieldVal(raw);
        if (val !== null) {
          last[key] = raw;
          row[key]  = val;
        } else if (isMergedSlave(ws, r, colMap[key])) {
          row[key] = last[key] instanceof Date ? last[key] : toFieldVal(last[key] ?? null);
        } else {
          row[key]  = null;
          last[key] = null;
        }
      }

      row.serial_number = toFieldVal(g(r, 'serial_number'));
      row.quantity      = parseQty(g(r, 'quantity'));
      row.remarks       = toFieldVal(g(r, 'remarks'));

      if (!row.acquisition_date) row.acquisition_date = g(r, 'acquisition_date');
      if (!row.return_date)      row.return_date      = g(r, 'return_date');

      let ownerOrg     = null;
      let equipmentNum = null;
      if (colMap.owner_item_no) {
        const itemNoVal = typeof row.owner_item_no === 'string' ? row.owner_item_no : null;
        if (itemNoVal) {
          ownerOrg     = ownerOrgName;
          equipmentNum = itemNoVal;
        }
      }

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
          manufacturer:       row.manufacturer  || null,
          product_name:       row.product_name  || null,
          model_number:       row.model_number  || null,
          serial_number:      row.serial_number || null,
          quantity:           row.quantity,
          acquisition_date:   acqDate           || null,
          return_date:        retDate           || null,
          state,
          location:           null,
          remarks:            row.remarks       || null,
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
// DF 양식 다운로드
// ─────────────────────────────────────────────────────────────────
const TMPL_THIN  = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
const TMPL_TITLE_FILL  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1F3864' } };
const TMPL_HEADER_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD9E1F2' } };
const TMPL_FONT_BASE   = { name:'맑은 고딕', size:11 };
const TMPL_FONT_HEADER = { name:'맑은 고딕', size:11, bold:true };
const TMPL_FONT_TITLE  = { name:'맑은 고딕', size:12, bold:true, color:{ argb:'FFFFFFFF' } };
 
const TMPL_HEADERS    = ['No', 'Item', '두산 Item No', 'Manufacturer', 'Product Name', 'Model Number', 'Serial Number', 'QTY', '대여일', '반납일', '비고'];
const TMPL_COL_WIDTHS = [8, 30, 30, 25, 30, 30, 22, 8, 14, 14, 50];
 
const downloadDfTemplate = async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TAMS';
 
  const ws      = wb.addWorksheet('DF_IMPORT');
  const lastCol = TMPL_HEADERS.length + 2 - 1;
 
  ws.getColumn(1).width = 4;
  TMPL_HEADERS.forEach((_, i) => { ws.getColumn(i + 2).width = TMPL_COL_WIDTHS[i]; });
 
  ws.mergeCells(1, 2, 1, lastCol);
  const titleCell     = ws.getRow(1).getCell(2);
  titleCell.value     = 'DF 자산 엑셀 양식';
  titleCell.font      = TMPL_FONT_TITLE;
  titleCell.fill      = TMPL_TITLE_FILL;
  titleCell.border    = TMPL_THIN;
  titleCell.alignment = { horizontal:'center', vertical:'middle' };
  ws.getRow(1).height = 60;
 
  TMPL_HEADERS.forEach((h, i) => {
    const cell     = ws.getRow(2).getCell(i + 2);
    cell.value     = h;
    cell.font      = TMPL_FONT_HEADER;
    cell.fill      = TMPL_HEADER_FILL;
    cell.border    = TMPL_THIN;
    cell.alignment = { horizontal:'center', vertical:'middle' };
  });
  ws.getRow(2).height = 30;
 
  TMPL_HEADERS.forEach((_, i) => {
    ws.getRow(3).getCell(i + 2).border = TMPL_THIN;
  });
  ws.getRow(3).height = 40;
 
  res.setHeader('Content-Disposition', 'attachment; filename="DF_IMPORT_TEMPLATE.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await wb.xlsx.write(res);
  res.end();
};
 
// ─────────────────────────────────────────────────────────────────
// SW 원본 IMPORT
// ─────────────────────────────────────────────────────────────────
const SW_COL = { num:0, name:1, ver:2, qty:3, issue_date:4, key:5, ktype:6, link:7, mfr:8, users:9, remarks:12 };

/**
 * sw_type 결정 헬퍼
 *
 * subscription : 키 없음 → 자리수(사용 인원)로 관리하는 구독형
 * license      : 키 있음 → 라이선스 키 기반 (영구/갱신 모두 포함)
 */
function determineSwType(licKeyRaw) {
  if (!licKeyRaw || licKeyRaw === '-') return 'subscription';
  return 'license';
}

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
  const licensedSwIds = new Set(); // 라이선스형/영구형 SW ID (사후 보정 대상)
  let lastName = null, lastMfr = null, lastVer = null, lastKeyType = null;

  const g = (row, col) => readXlsxCell(row, col);

  // ── 사용자 문자열 파싱 헬퍼 ────────────────────────────────────
  function parseUserEntries(rawUsers) {
    const entries = [];
    let sdoeCount = 0;

    const rawList = rawUsers
      ? rawUsers.split(',').map(u => u.trim()).filter(u => u && u !== '-')
      : [];

    for (const uName of rawList) {
      const sdoeMatch = uName.match(SDOE_RE);
      if (sdoeMatch) {
        sdoeCount += sdoeMatch[1] ? Number(sdoeMatch[1]) : 1;
      } else {
        const mappedId = nameToUserId[uName] ?? null;
        entries.push({
          userId:   mappedId,
          userNote: mappedId !== null ? null : uName,
        });
      }
    }

    return { entries, sdoeCount };
  }

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

    const name    = toVal(rawName) ?? lastName;
    const mfr     = toVal(rawMfr)  ?? lastMfr;
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

    const licKeyRaw = toVal(rawKey);

    // ── isNewSw: sw_type 사전 결정 ─────────────────────────────
    const swTypeForNew = isNewSw ? determineSwType(licKeyRaw) : null;

    try {
      let sw;
      if (isNewSw) {
        const qty = parseInt(String(rawQty ?? '0').trim(), 10);
        sw = await AssetSw.create({
          name,
          version:          ver     || null,
          manufacturer:     mfr     || null,
          quantity:         isNaN(qty) ? 0 : qty,
          acquisition_date: null,
          sw_type:          swTypeForNew,
          license_required: swTypeForNew !== 'subscription',
          related_link:     relLink || null,
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

      // sw_type 기반 isSubscription 결정 (carry-forward 행도 기존 SW 타입 상속)
      const isSubscription = sw.sw_type === 'subscription';

      const issueDate = rawIssue instanceof Date ? rawIssue : parseDate(rawIssue);
      const { entries: userEntries, sdoeCount } = parseUserEntries(rawUsers);

      // ── 구독형: license_key 없는 SW ──────────────────────────
      if (isSubscription) {
        for (const entry of userEntries) {
          const lic = await AssetSwLicense.create({
            asset_sw_id:      sw.id,
            user_id:          entry.userId,
            user_note:        entry.userNote,
            license_key:      null,
            license_password: null,
            key_type:         null,
            license_type:     'per_seat',
            issue_date:       null,
            state:            'in_use',
          });
          await AssetSwHistory.create({
            asset_sw_id:  sw.id, license_id: lic.id,
            user_id:      entry.userId, change_type: 'register',
            before_value: null, after_value: 'in_use',
          });
        }

        for (let s = 0; s < sdoeCount; s++) {
          const lic = await AssetSwLicense.create({
            asset_sw_id:      sw.id,
            user_id:          null,
            user_note:        'SDOE',
            license_key:      null,
            license_password: null,
            key_type:         null,
            license_type:     'per_seat',
            issue_date:       null,
            state:            'in_use',
          });
          await AssetSwHistory.create({
            asset_sw_id:  sw.id, license_id: lic.id,
            user_id:      null, change_type: 'register',
            before_value: null, after_value: 'in_use',
          });
        }

        // 사용자/SDOE 모두 없음 → available 레코드만 생성 (asset_sw_id, license_type, state 외 전부 null)
        if (userEntries.length === 0 && sdoeCount === 0) {
          await AssetSwLicense.create({
            asset_sw_id:      sw.id,
            user_id:          null,
            user_note:        null,
            license_key:      null,
            license_password: null,
            key_type:         null,
            license_type:     'per_seat',
            issue_date:       null,
            state:            'available',
          });
        }

        const totalLicenseCount = await AssetSwLicense.count({ where: { asset_sw_id: sw.id } });
        await sw.reload();
        const newQuantity = Math.max(sw.quantity, totalLicenseCount);
        await sw.update({ quantity: newQuantity });
        await recalcSwState(sw.id, null);

        results.push({ row: r, status: 'success', sw_id: sw.id, new_sw: isNewSw, name, note: '구독형' });
        imported++;
        continue;
      }

      // ── 라이선스형 / 영구형: license_key 있는 SW ─────────────
      // credential 타입: "id,password" 분리
      let finalLicKey, licPassword;
      if (keyType === 'credential' && licKeyRaw) {
        const sepIdx = licKeyRaw.indexOf(',');
        if (sepIdx !== -1) {
          finalLicKey = licKeyRaw.slice(0, sepIdx).trim() || null;
          licPassword = licKeyRaw.slice(sepIdx + 1).trim() || null;
        } else {
          finalLicKey = licKeyRaw;
          licPassword = null;
        }
      } else {
        finalLicKey = licKeyRaw;
        licPassword = null;
      }

      // 모든 라이선스는 기본 per_seat으로 생성
      // shared 여부는 루프 종료 후 사후 보정에서 결정
      for (const entry of userEntries) {
        const lic = await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          entry.userId,
          user_note:        entry.userNote,
          license_key:      finalLicKey,
          license_password: licPassword,
          key_type:         keyType,
          license_type:     'per_seat',
          issue_date:       issueDate,
          state:            'in_use',
        });
        await AssetSwHistory.create({
          asset_sw_id:  sw.id, license_id: lic.id,
          user_id:      entry.userId, change_type: 'register',
          before_value: null, after_value: 'in_use',
        });
      }

      for (let s = 0; s < sdoeCount; s++) {
        const lic = await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          null,
          user_note:        'SDOE',
          license_key:      finalLicKey,
          license_password: licPassword,
          key_type:         keyType,
          license_type:     'per_seat',
          issue_date:       issueDate,
          state:            'in_use',
        });
        await AssetSwHistory.create({
          asset_sw_id:  sw.id, license_id: lic.id,
          user_id:      null, change_type: 'register',
          before_value: null, after_value: 'in_use',
        });
      }

      // 사용자/SDOE 모두 없음 → 미사용 라이선스 (available)
      if (userEntries.length === 0 && sdoeCount === 0) {
        await AssetSwLicense.create({
          asset_sw_id:      sw.id,
          user_id:          null,
          user_note:        null,
          license_key:      finalLicKey,
          license_password: licPassword,
          key_type:         keyType,
          license_type:     'per_seat',
          issue_date:       issueDate,
          state:            'available',
        });
      }

      await recalcSwState(sw.id, null);

      licensedSwIds.add(sw.id);
      results.push({ row: r, status: 'success', sw_id: sw.id, new_sw: isNewSw, name, ver });
      imported++;
    } catch (err) {
      results.push({ row: r, status: 'failed', reason: err.message });
      failed++;
    }
  }

  // ── 사후 보정: shared/per_seat 최종 결정 ──────────────────────
  //
  // Rule 1: unique 키가 정확히 1개이고 sw.quantity > 해당 키 레코드 수
  //         → 키 1개가 여러 자리를 커버하는 경우 → 전체 shared
  //         (예: qty=3, 키 A, 사용자 1명 → 3>1 → shared)
  //         ※ 키 N개, 각 사용자 1명, qty>N 케이스는 per_seat 유지
  //         (예: qty=11, 키 6개, 각 1명 → unique≠1 → Rule 1 미적용)
  //
  // Rule 2: 동일 license_key를 2개 이상 레코드가 공유
  //         → carry-forward로 같은 키가 여러 행에 분산된 경우 포함
  //         → 해당 키의 레코드만 shared
  //         (예: 키 A → 김철수 / 키 A → 이영희 → 키 A만 shared)
  //
  // 두 조건 모두 해당 없으면 per_seat 유지 (기본값)
  for (const swId of licensedSwIds) {
    const sw = await AssetSw.findByPk(swId);
    if (!sw) continue;

    // unique 키별 레코드 수를 한 번에 조회 (Rule 1, 2 공통 사용)
    const keyGroups = await AssetSwLicense.findAll({
      where: {
        asset_sw_id: swId,
        license_key: { [Op.ne]: null },
      },
      attributes: [
        'license_key',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cnt'],
      ],
      group: ['license_key'],
      raw: true,
    });

    const uniqueKeyCount    = keyGroups.length;
    const totalKeyedCount   = keyGroups.reduce((sum, g) => sum + parseInt(g.cnt, 10), 0);

    // Rule 1: unique 키 1개 + 수량 > 해당 키 레코드 수 → 전체 shared
    if (uniqueKeyCount === 1 && sw.quantity > totalKeyedCount) {
      await AssetSwLicense.update(
        { license_type: 'shared' },
        { where: { asset_sw_id: swId } }
      );
      continue; // Rule 2 불필요
    }

    // Rule 2: 동일 license_key 레코드 2개 이상 → 해당 키만 shared
    for (const group of keyGroups) {
      if (parseInt(group.cnt, 10) >= 2) {
        await AssetSwLicense.update(
          { license_type: 'shared' },
          { where: { asset_sw_id: swId, license_key: group.license_key } }
        );
      }
    }
  }

  return res.status(200).json({
    message: `SW Import 완료: ${imported}건 성공, ${failed}건 실패`,
    imported, failed, results,
  });
};
 
// ─────────────────────────────────────────────────────────────────
// Enterprise 원본 IMPORT
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