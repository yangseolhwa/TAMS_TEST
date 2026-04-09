'use strict';

const sequelize = require('../config/db');
const {
  AssetProject, AssetProjectItem, AssetProjectItemType, AssetProjectHistory,
  AssetSw, AssetSwLicense, AssetSwHistory,
  AssetEnterprise, AssetEnterpriseCategory, AssetEnterpriseItemType,
  AssetEnterpriseHistory, Department, Profile, User,
} = require('../models');

// ─────────────────────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────────────────────
function toVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return (s === '' || s === '-' || s.toLowerCase() === 'n/a') ? null : s;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s || s === '-') return null;
  const d = new Date(s.replace(/\./g, '-'));
  return isNaN(d.getTime()) ? null : d;
}

// ExcelJS 셀 값 읽기 (하이퍼링크 객체 처리 포함)
function readCell(ws, r, col) {
  if (!col) return null;
  const v = ws.getCell(r, col).value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') return (v.hyperlink || v.text || '').trim() || null;
  return String(v).trim();
}

const KEY_TYPE_MAP = { '시리얼': 'serial', '크레덴셜': 'credential' };
const SPECIAL_USER_RE = /sdoe|공용|관리자/i;

function isSpecialUser(name) {
  return SPECIAL_USER_RE.test(name.trim());
}

async function loadExcel(file) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file.buffer);
  return wb;
}

// ─────────────────────────────────────────────────────────────
// DF IMPORT
// ─────────────────────────────────────────────────────────────
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
    const row = [];
    for (let c = 1; c <= 20; c++) {
      const v = ws.getCell(r, c).value;
      row.push(v != null ? String(v).trim() : '');
    }
    const isHeader = row.some(v => {
      const l = v.toLowerCase();
      return ['대분류', '중분류', '소분류', 'card', '중뷴류'].includes(l);
    });
    if (!isHeader) continue;

    const colMap = {};
    for (const [key, keywords] of Object.entries(KEYWORD_MAP)) {
      colMap[key] = null;
      for (let c = 0; c < row.length; c++) {
        if (keywords.some(kw => row[c].toLowerCase() === kw.toLowerCase())) {
          colMap[key] = c + 1;
          break;
        }
      }
    }
    return { colMap, dataStartRow: r + 1 };
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
    const { colMap, dataStartRow } = detected;

    if (!projectCache[ws.name]) {
      const [proj] = await AssetProject.findOrCreate({ where: { name: ws.name }, defaults: { name: ws.name } });
      projectCache[ws.name] = proj.id;
    }
    const project_id = projectCache[ws.name];

    const CARRY_COLS = ['manufacturer','parent_type','sub_type','model_name','spec',
                        'acquisition_date','return_date','location','remarks',
                        'owner_organization','equipment_number'];
    const last = {};

    for (let r = dataStartRow; r <= ws.rowCount; r++) {
      const g = (key) => readCell(ws, r, colMap[key]);

      // carry-forward
      const row = {};
      for (const key of CARRY_COLS) {
        const raw = g(key);
        const val = raw instanceof Date ? raw : toVal(raw);
        if (val !== null) { last[key] = raw; row[key] = val; }
        else { row[key] = last[key] instanceof Date ? last[key] : toVal(last[key] ?? null); }
      }
      row.serial_number = toVal(g('serial_number'));

      if (!row.sub_type && !row.model_name && !row.manufacturer) continue;

      const typeName = row.sub_type || row.parent_type;
      if (!typeName) {
        results.push({ sheet: ws.name, row: r, status: 'failed', reason: '자산 분류 없음' });
        failed++; continue;
      }

      // parent_type
      let parentId = null;
      if (row.parent_type) {
        const pk = `ROOT::${row.parent_type}`;
        if (!typeCache[pk]) {
          const [pt] = await AssetProjectItemType.findOrCreate({
            where: { name: row.parent_type, parent_id: null },
            defaults: { name: row.parent_type, parent_id: null },
          });
          typeCache[pk] = pt.id;
        }
        parentId = typeCache[pk];
      }

      // sub_type
      const sk = `${parentId ?? 'ROOT'}::${typeName}`;
      if (!typeCache[sk]) {
        const [st] = await AssetProjectItemType.findOrCreate({
          where: { name: typeName, parent_id: parentId },
          defaults: { name: typeName, parent_id: parentId },
        });
        typeCache[sk] = st.id;
      }

      const acqDate = row.acquisition_date instanceof Date ? row.acquisition_date : parseDate(row.acquisition_date);
      const retDate = row.return_date instanceof Date ? row.return_date : parseDate(row.return_date);

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
          asset_type_id:      typeCache[sk],
          owner_organization: colMap.owner_organization ? row.owner_organization : null,
          equipment_number:   colMap.equipment_number   ? row.equipment_number   : null,
          manufacturer:       row.manufacturer  || null,
          model_name:         row.model_name    || null,
          serial_number:      row.serial_number || null,
          spec:               row.spec          || null,
          acquisition_date:   acqDate           || null,
          return_date:        retDate           || null,
          state:              'in_use',
          location:           row.location      || null,
          remarks:            row.remarks        || null,
        }, { transaction: t });

        await AssetProjectHistory.create({
          asset_project_item_id: item.id, project_id,
          user_id: req.user.userId, change_type: 'register',
          before_value: null, after_value: 'in_use',
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

// ─────────────────────────────────────────────────────────────
// DF 양식 다운로드
// ─────────────────────────────────────────────────────────────
const downloadDfTemplate = async (req, res) => {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');

  const HEADERS    = ['No','제조사','대분류','중분류','모델명','시리얼 넘버','규격','대여일','반납일','위치','비고'];
  const COL_WIDTHS = [8, 14, 14, 14, 18, 20, 14, 14, 14, 16, 20];
  const THIN = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  const FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD9E1F2' } };

  ws.getColumn(1).width = 4;
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
  HEADERS.forEach((_, i) => { ws.getRow(2).getCell(i + 2).border = THIN; });
  ws.getRow(2).height = 25;

  res.setHeader('Content-Disposition', 'attachment; filename="DF_IMPORT_TEMPLATE.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await wb.xlsx.write(res);
  res.end();
};

// ─────────────────────────────────────────────────────────────
// SW 원본 IMPORT
// ─────────────────────────────────────────────────────────────
// 컬럼 인덱스 (0-indexed, xlsx 라이브러리 기준)
// 번호(0) 제품명(1) 버전(2) 수량(3) 발급일자(4) 제품키(5) 키종류(6)
// 관련링크(7) 제조사(8) 사용자(9) 사용자수량(10) 남은수량(11) 비고(12)
const SW_COL = { num:0, name:1, ver:2, qty:3, issue_date:4, key:5, ktype:6, link:7, mfr:8, users:9, remarks:12 };

const importSwOriginal = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });

  let rows;
  try {
    const XLSX = require('xlsx');
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const ws   = wb.Sheets['SW LIST'] || wb.Sheets[wb.SheetNames[0]];
    // defval: null → 병합 셀 비마스터 행은 null 반환 (openpyxl과 동일)
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  } catch {
    return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' });
  }

  // profile.name → user_id 캐시
  const profiles = await Profile.findAll({ include: [{ model: User, attributes: ['id'] }] });
  const nameToUserId = {};
  profiles.forEach(p => { if (p.name) nameToUserId[p.name.trim()] = p.user_id; });

  const results = [];
  let imported = 0, failed = 0;

  let lastSwId = null;
  let lastName = null, lastMfr = null, lastVer = null, lastKeyType = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const r   = i + 1; // 엑셀 행 번호 (1-indexed)

    const g = (col) => {
      const v = row[col];
      if (v == null) return null;
      if (v instanceof Date) return v;
      const s = String(v).trim();
      return s === '' ? null : s;
    };

    const rawNum    = g(SW_COL.num);
    const rawName   = g(SW_COL.name);
    const rawVer    = g(SW_COL.ver);
    const rawQty    = g(SW_COL.qty);
    const rawIssue  = g(SW_COL.issue_date);
    const rawKey    = g(SW_COL.key);
    const rawKtype  = g(SW_COL.ktype);
    const rawLink   = g(SW_COL.link);
    const rawMfr    = g(SW_COL.mfr);
    const rawUsers  = g(SW_COL.users);
    const rawRemarks = g(SW_COL.remarks);

    // 완전히 빈 행 건너뜀 (공백만 있는 사용자 셀 포함)
    if (!rawNum && !rawName && !rawKey && !rawUsers?.trim()) continue;

    // 번호(A열)가 있으면 새 SW, 없으면 직전 SW에 라이선스 추가
    const isNewSw = rawNum !== null;

    // name/mfr: 병합 셀이므로 항상 carry-forward
    const name = toVal(rawName) ?? lastName;
    const mfr  = toVal(rawMfr)  ?? lastMfr;

    // ver/keyType/relLink:
    //   새 SW 행 → 원본 값 그대로 사용 (빈 셀이면 null, carry-forward 없음)
    //   연속 행  → carry-forward 적용 (병합 셀 대응)
    const ver     = isNewSw
      ? toVal(rawVer)
      : (toVal(rawVer) ?? lastVer);
    const keyType = isNewSw
      ? (rawKtype ? (KEY_TYPE_MAP[rawKtype] ?? null) : null)
      : ((rawKtype ? (KEY_TYPE_MAP[rawKtype] ?? null) : null) ?? lastKeyType);

    // related_link: carry-forward 없음 (각 행 독립)
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
          version:          ver  || null,
          manufacturer:     mfr  || null,
          quantity:         (rawQty && rawQty !== '-') ? Number(rawQty) : 0,
          acquisition_date: null, // 원본 엑셀에 SW 취득일 컬럼 없음
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

      // ── 라이선스 키 처리 ──────────────────────────────────────
      // rawKey = '-'  → 키 없음, 저장 안 함
      // rawKey = null → 빈 셀 = 보안상 지운 값, null로 저장
      if (rawKey === '-') {
        results.push({ row: r, status: 'skipped', reason: '라이선스 키 없음 (-)' });
        continue;
      }

      // 크레덴셜: 첫 번째 ',' 기준으로 앞=license_key, 뒤=license_password
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
        licKey      = rawKey || null; // null(빈셀) → null 저장 (값 있다고 판단)
        licPassword = null;
      }

      // issue_date: 각 행 독립적으로 읽음 (carry-forward 없음)
      const issueDate = rawIssue instanceof Date ? rawIssue : parseDate(rawIssue);

      // 사용자 파싱
      // 'SDOE N대' → N개의 user_id=null 라이선스 생성
      // 'SDOE' 단독 → 1개
      const SDOE_RE = /^sdoe\s*(\d+)?대?$/i;
      let sdoeCount = 0;
      const userNames = rawUsers
        ? rawUsers.split(',').map(u => u.trim()).filter(u => u && u !== '-').filter(u => {
            const m = u.match(SDOE_RE);
            if (m) { sdoeCount += m[1] ? Number(m[1]) : 1; return false; }
            return true;
          })
        : [];

      if (userNames.length > 0) {
        for (const uName of userNames) {
          const isSpecial = isSpecialUser(uName);
          const userId    = isSpecial ? null : (nameToUserId[uName] ?? null);
          const licRemark = isSpecial ? uName : null; // SDOE, 관리자 노트북 등 remarks에 기록
          const lic = await AssetSwLicense.create({
            asset_sw_id: sw.id, user_id: userId,
            license_key: licKey, license_password: licPassword,
            key_type: keyType, related_link: relLink,
            issue_date: issueDate,
            remarks: licRemark,
            state: 'in_use',
          });
          await AssetSwHistory.create({
            asset_sw_id: sw.id, license_id: lic.id,
            user_id: userId, change_type: 'register',
            before_value: null, after_value: 'in_use',
          });
        }
      } else if (sdoeCount === 0) {
        // 사용자도 SDOE도 없음 → available 1개
        await AssetSwLicense.create({
          asset_sw_id: sw.id, user_id: null,
          license_key: licKey, license_password: licPassword,
          key_type: keyType, related_link: relLink,
          issue_date: issueDate,
          remarks: null,
          state: 'available',
        });
      }

      // SDOE N대 → user_id=null, remarks='SDOE', in_use 라이선스 N개
      for (let s = 0; s < sdoeCount; s++) {
        const lic = await AssetSwLicense.create({
          asset_sw_id: sw.id, user_id: null,
          license_key: licKey, license_password: licPassword,
          key_type: keyType, related_link: relLink,
          issue_date: issueDate,
          remarks: 'SDOE',
          state: 'in_use',
        });
        await AssetSwHistory.create({
          asset_sw_id: sw.id, license_id: lic.id,
          user_id: null, change_type: 'register',
          before_value: null, after_value: 'in_use',
        });
      }

      // asset_sw.state 갱신
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

// ─────────────────────────────────────────────────────────────
// Enterprise 원본 IMPORT
// ─────────────────────────────────────────────────────────────
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
  if (!location || location === '-') return { type: 'vacant', value: null };
  const s = location.trim();
  if (s === '공석') return { type: 'vacant',   value: null };
  if (s === '공용') return { type: 'shared',    value: s };
  if (nameToUserId[s] !== undefined) return { type: 'personal', value: s };
  return { type: 'place', value: s };
}

const importEnterpriseOriginal = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });

  let wb;
  try { wb = await loadExcel(req.file); }
  catch { return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다.' }); }

  const ws = wb.getWorksheet('Rawdata') || wb.worksheets[0];
  if (!ws) return res.status(400).json({ message: 'Rawdata 시트를 찾을 수 없습니다.' });

  // 헤더: 자산번호(1) 소관부서(2) 사용위치(3) 취득일자(4) 제조사(5) 분류(6) 규격(7) 일련번호(8) 비고(9)
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

  for (let r = 2; r <= ws.rowCount; r++) {
    const g = (col) => readCell(ws, r, col);

    const assetNumber = toVal(g(C.assetNum));
    const deptName    = toVal(g(C.dept));
    const location    = toVal(g(C.location));
    const typeName    = toVal(g(C.typeName));

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
      // category
      if (!catCache[catName]) {
        const [cat] = await AssetEnterpriseCategory.findOrCreate({ where: { name: catName }, defaults: { name: catName } });
        catCache[catName] = cat.id;
      }
      const category_id = catCache[catName];

      // item_type: category_id + code + name 조합
      const resolvedName = typeName || code;
      const typeKey = `${category_id}::${code}::${resolvedName}`;
      if (!typeCache[typeKey]) {
        const [itemType] = await AssetEnterpriseItemType.findOrCreate({
          where:    { category_id, code, name: resolvedName },
          defaults: { category_id, code, name: resolvedName },
        });
        typeCache[typeKey] = itemType.id;
      }

      // responsible
      const { type: responsibleType, value: responsibleValue } = resolveResponsible(location, nameToUserId);
      const userId = responsibleType === 'personal' ? (nameToUserId[location?.trim()] ?? null) : null;

      // department:
      // personal → 유저 프로필의 부서 자동 할당 (없으면 소관부서 컬럼 fallback)
      // 그 외    → 소관부서 컬럼 사용
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
        asset_number:      assetNumber,
        category_id,
        item_type_id:      typeCache[typeKey],
        department_id,
        responsible_type:  responsibleType,
        user_id:           userId,
        responsible_value: responsibleValue,
        state:             'in_use',
        acquisition_date:  parseDate(g(C.acq)) || null,
        manufacturer:      toVal(g(C.mfr))     || null,
        spec:              toVal(g(C.spec))     || null,
        serial_number:     toVal(g(C.serial))   || null,
        location:          location             || null,
        remarks:           toVal(g(C.remarks))  || null,
      });

      await AssetEnterpriseHistory.create({
        asset_enterprise_id: asset.id,
        user_id: req.user.userId,
        change_type: 'register', before_value: null, after_value: 'in_use',
      });

      results.push({ row: r, status: 'success', asset_id: asset.id, asset_number: assetNumber });
      imported++;
    } catch (err) {
      results.push({ row: r, status: 'failed', reason: err.message, asset_number: assetNumber });
      failed++;
    }
  }

  return res.status(200).json({ message: `Enterprise Import 완료: ${imported}건 성공, ${failed}건 실패`, imported, failed, results });
};

module.exports = { importDf, downloadDfTemplate, importSwOriginal, importEnterpriseOriginal };