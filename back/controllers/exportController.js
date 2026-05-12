'use strict';

const logger = require('../config/logger');
const ExcelJS = require('exceljs');
const { AssetProjectItem, AssetProjectItemType, AssetProject } = require('../models');
const { Op } = require('sequelize');
const { PLC_ITEM_KEYWORDS } = require('../config/dfConfig');

// ── 스타일 상수 ────────────────────────────────────────────────────
const THIN_BORDER = {
  top:    { style: 'thin' },
  left:   { style: 'thin' },
  bottom: { style: 'thin' },
  right:  { style: 'thin' },
};

const PROJ_HEADER_FILL       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const TOTAL_HEADER_FILL      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
const TOTAL_PROJ_NAME_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
const TOTAL_TITLE_FILL       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
const TOTAL_SUMMARY_HDR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };

const FONT_BASE      = { name: '맑은 고딕', size: 11 };
const FONT_HEADER    = { ...FONT_BASE, bold: true };
const FONT_PROJ_NAME = { ...FONT_BASE, bold: true, color: { argb: 'FFFFFFFF' } };
const FONT_TITLE     = { ...FONT_BASE, bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
const FONT_TOTAL_HDR = { ...FONT_BASE, bold: true, color: { argb: 'FFFFFFFF' } };

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ── 시트 타입 결정 ─────────────────────────────────────────────────
function resolveSheetType(item) {
  const parentName = item.item_type?.parent?.name;
  if (parentName === 'PC' || parentName === 'PLC') return parentName;
  const typeName = item.item_type?.name ?? '';
  return PLC_ITEM_KEYWORDS.has(typeName) ? 'PLC' : 'PC';
}

// ── 정렬 ─────────────────────────────────────────────────────────
function sortPcItems(items) {
  return [...items].sort((a, b) => {
    const pairs = [
      [a.item_type?.name              ?? '', b.item_type?.name              ?? ''],
      [a.equipment_number             ?? '', b.equipment_number             ?? ''],
      [a.manufacturer                 ?? '', b.manufacturer                 ?? ''],
      [a.product_name                 ?? '', b.product_name                 ?? ''],
      [a.model_number                 ?? '', b.model_number                 ?? ''],
      [formatDate(a.acquisition_date) ?? '', formatDate(b.acquisition_date) ?? ''],
    ];
    for (const [av, bv] of pairs) {
      const r = av.localeCompare(bv, 'ko');
      if (r !== 0) return r;
    }
    return 0;
  });
}

// ── 계층적 셀 병합 ────────────────────────────────────────────────
function applyMerges(ws, dataStartRow, items, mergeRules) {
  if (items.length < 2) return;

  for (const { col, keyFn } of mergeRules) {
    let groupStart = 0;
    for (let i = 1; i <= items.length; i++) {
      const prevKey = keyFn(groupStart);
      const currKey = i < items.length ? keyFn(i) : null;
      if (i === items.length || prevKey !== currKey) {
        const startRow = dataStartRow + groupStart;
        const endRow   = dataStartRow + i - 1;
        if (endRow > startRow) {
          ws.mergeCells(startRow, col, endRow, col);
        }
        const cell     = ws.getCell(startRow, col);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border    = THIN_BORDER;
        groupStart = i;
      }
    }
  }
}

// ── 통합 컬럼 정의 ────────────────────────────────────────────────
const UNIFIED_HEADERS    = ['No', 'Item', '두산 Item No', 'Manufacturer', 'Product Name', 'Model Number', 'Serial Number', 'QTY', '대여일', '반납일', '비고'];
const UNIFIED_COL_WIDTHS = [8, 16, 16, 16, 22, 20, 22, 8, 14, 14, 20];

// ── 병합 규칙 ────────────────────────────────────────────────────
function buildMergeRules(items) {
  const S   = '\x00';
  const gi  = (i) => items[i].item_type?.name              ?? '';
  const ge  = (i) => items[i].equipment_number             ?? '';
  const gm  = (i) => items[i].manufacturer                 ?? '';
  const gp  = (i) => items[i].product_name                 ?? '';
  const gmn = (i) => items[i].model_number                 ?? '';
  const gd  = (i) => formatDate(items[i].acquisition_date) ?? '';

  return [
    { col: 3,  keyFn: (i) => gi(i) },
    { col: 4,  keyFn: (i) => `${gi(i)}${S}${ge(i)}` },
    { col: 5,  keyFn: (i) => `${gi(i)}${S}${ge(i)}${S}${gm(i)}` },
    { col: 6,  keyFn: (i) => `${gi(i)}${S}${ge(i)}${S}${gm(i)}${S}${gp(i)}` },
    { col: 7,  keyFn: (i) => `${gi(i)}${S}${ge(i)}${S}${gm(i)}${S}${gp(i)}${S}${gmn(i)}` },
    { col: 10, keyFn: (i) => `${gi(i)}${S}${ge(i)}${S}${gm(i)}${S}${gp(i)}${S}${gmn(i)}${S}${gd(i)}` },
  ];
}

// ── 프로젝트 시트 빌드 ────────────────────────────────────────────
/**
 * @param {ExcelJS.Workbook} wb
 * @param {string}  sheetName
 * @param {object[]} rawItems
 * @param {boolean} isAllReturned - true이면 시트 탭을 빨간색으로 표시
 */
function buildProjectSheet(wb, sheetName, rawItems, isAllReturned = false) {
  const ws             = wb.addWorksheet(sheetName);
  const DATA_START_ROW = 3;

  // 프로젝트 내 모든 자산이 반납된 경우 탭 색상을 빨간색으로 표시
  if (isAllReturned) {
    ws.properties.tabColor = { argb: 'FFFF0000' };
  }

  ws.getColumn(1).width = 4;
  UNIFIED_HEADERS.forEach((_, i) => { ws.getColumn(i + 2).width = UNIFIED_COL_WIDTHS[i]; });

  // 타이틀 행 (Row 1)
  const lastCol = UNIFIED_HEADERS.length + 2 - 1;
  ws.mergeCells(1, 2, 1, lastCol);
  const titleCell     = ws.getRow(1).getCell(2);
  titleCell.value     = sheetName;
  titleCell.font      = FONT_TITLE;
  titleCell.fill      = TOTAL_TITLE_FILL;
  titleCell.border    = THIN_BORDER;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // 헤더 행 (Row 2)
  const headerRow = ws.getRow(2);
  UNIFIED_HEADERS.forEach((h, i) => {
    const cell     = headerRow.getCell(i + 2);
    cell.value     = h;
    cell.font      = FONT_HEADER;
    cell.fill      = PROJ_HEADER_FILL;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 30;

  // 데이터 행
  const items = sortPcItems(rawItems);
  items.forEach((item, idx) => {
    const row    = ws.getRow(DATA_START_ROW + idx);
    const values = [
      idx + 1,
      item.item_type?.name              || '-',
      item.equipment_number             || '-',
      item.manufacturer                 || '-',
      item.product_name                 || '-',
      item.model_number                 || '-',
      item.serial_number                || '-',
      item.quantity                     ?? '-',
      formatDate(item.acquisition_date) || '-',
      formatDate(item.return_date)      || '-',
      item.remarks                      || '-',
    ];
    values.forEach((v, i) => {
      const cell     = row.getCell(i + 2);
      cell.value     = v;
      cell.font      = FONT_BASE;
      cell.border    = THIN_BORDER;
      cell.alignment = { vertical: 'middle' };
    });
    row.height = 35;
  });

  // 병합
  applyMerges(ws, DATA_START_ROW, items, buildMergeRules(items));
}


// ── TOTAL 시트 빌드 ───────────────────────────────────────────────
const PROJ_BLOCK_START_COL = 6;
const PROJ_BLOCK_WIDTH     = 3;
const PROJS_PER_ROW        = 3;

function buildTotalSheet(wb, grouped) {
  const ws           = wb.getWorksheet('TOTAL') || wb.addWorksheet('TOTAL');
  const projectNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ko'));

  const TC_B = 2, TC_C = 3, TC_D = 4;

  const grandMap = {};
  for (const name of projectNames) {
    for (const item of grouped[name]) {
      const parent = item.item_type?.parent?.name ?? '-';
      const type   = item.item_type?.name         ?? '-';
      const key    = `${parent}\x00${type}`;
      if (!grandMap[key]) grandMap[key] = { parent, type, count: 0 };
      grandMap[key].count += 1;
    }
  }
  const grandRows = Object.values(grandMap).sort((a, b) => {
    const pr = a.parent.localeCompare(b.parent, 'ko');
    return pr !== 0 ? pr : a.type.localeCompare(b.type, 'ko');
  });

  let tr = 1;

  ws.mergeCells(tr, TC_B, tr, TC_D);
  const titleCell     = ws.getRow(tr).getCell(TC_B);
  titleCell.value     = 'Total';
  titleCell.font      = FONT_TITLE;
  titleCell.fill      = TOTAL_TITLE_FILL;
  titleCell.border    = THIN_BORDER;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(tr).height = 28;
  tr++;

  ['분류', '구분', '수량 (EA)'].forEach((h, i) => {
    const cell     = ws.getRow(tr).getCell(TC_B + i);
    cell.value     = h;
    cell.font      = FONT_TOTAL_HDR;
    cell.fill      = TOTAL_SUMMARY_HDR_FILL;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(tr).height = 24;
  tr++;

  const grandDataStart = tr;
  grandRows.forEach((r, idx) => {
    const row  = ws.getRow(tr + idx);
    const cB   = row.getCell(TC_B);
    const cC   = row.getCell(TC_C);
    const cD   = row.getCell(TC_D);
    cB.value   = r.parent;
    cC.value   = r.type;
    cD.value   = r.count;
    [cB, cC, cD].forEach(c => {
      c.font      = FONT_BASE;
      c.border    = THIN_BORDER;
      c.alignment = { vertical: 'middle' };
    });
    row.height = 22;
  });
  tr += grandRows.length;

  ws.mergeCells(tr, TC_B, tr, TC_C);
  const sumLabel     = ws.getRow(tr).getCell(TC_B);
  sumLabel.value     = '합계';
  sumLabel.font      = FONT_HEADER;
  sumLabel.fill      = TOTAL_HEADER_FILL;
  sumLabel.border    = THIN_BORDER;
  sumLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  const sumVal       = ws.getRow(tr).getCell(TC_D);
  sumVal.value       = grandRows.reduce((acc, r) => acc + r.count, 0);
  sumVal.font        = FONT_HEADER;
  sumVal.fill        = TOTAL_HEADER_FILL;
  sumVal.border      = THIN_BORDER;
  sumVal.alignment   = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(tr).height = 22;

  {
    let gs = 0;
    for (let i = 1; i <= grandRows.length; i++) {
      const prev = grandRows[gs].parent;
      const curr = i < grandRows.length ? grandRows[i].parent : null;
      if (i === grandRows.length || prev !== curr) {
        const sr = grandDataStart + gs;
        const er = grandDataStart + i - 1;
        if (er > sr) {
          ws.mergeCells(sr, TC_B, er, TC_B);
          const cell     = ws.getCell(sr, TC_B);
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border    = THIN_BORDER;
        }
        gs = i;
      }
    }
  }

  ws.getColumn(TC_B).width = 12;
  ws.getColumn(TC_C).width = 18;
  ws.getColumn(TC_D).width = 10;

  let pr = 1;

  for (let blockStart = 0; blockStart < projectNames.length; blockStart += PROJS_PER_ROW) {
    const chunk = projectNames.slice(blockStart, blockStart + PROJS_PER_ROW);

    const summaries = chunk.map((name) => {
      const typeCount = {};
      grouped[name].forEach((item) => {
        const label = item.item_type?.name ?? '장비';
        typeCount[label] = (typeCount[label] || 0) + 1;
      });
      return Object.entries(typeCount).sort(([a], [b]) => a.localeCompare(b, 'ko'));
    });
    const maxDataRows = Math.max(...summaries.map((s) => s.length + 1));

    chunk.forEach((projName, ci) => {
      const colB = PROJ_BLOCK_START_COL + ci * PROJ_BLOCK_WIDTH;
      const colC = colB + 1;

      ws.mergeCells(pr, colB, pr, colC);
      const nameCell     = ws.getRow(pr).getCell(colB);
      nameCell.value     = projName;
      nameCell.font      = FONT_PROJ_NAME;
      nameCell.fill      = TOTAL_PROJ_NAME_FILL;
      nameCell.border    = THIN_BORDER;
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const hB = ws.getRow(pr + 1).getCell(colB);
      const hC = ws.getRow(pr + 1).getCell(colC);
      hB.value = '분류';
      hC.value = '수량';
      [hB, hC].forEach((c) => {
        c.font      = FONT_HEADER;
        c.fill      = TOTAL_HEADER_FILL;
        c.border    = THIN_BORDER;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      summaries[ci].forEach(([label, cnt], di) => {
        const dB  = ws.getRow(pr + 2 + di).getCell(colB);
        const dC  = ws.getRow(pr + 2 + di).getCell(colC);
        dB.value  = label;
        dC.value  = cnt;
        [dB, dC].forEach((c) => {
          c.font      = FONT_BASE;
          c.border    = THIN_BORDER;
          c.alignment = { vertical: 'middle' };
        });
      });

      const totalCnt  = summaries[ci].reduce((acc, [, cnt]) => acc + cnt, 0);
      const sumRowIdx = pr + 2 + summaries[ci].length;
      const sB = ws.getRow(sumRowIdx).getCell(colB);
      const sC = ws.getRow(sumRowIdx).getCell(colC);
      sB.value = '합계';
      sC.value = totalCnt;
      [sB, sC].forEach((c) => {
        c.font      = FONT_HEADER;
        c.fill      = TOTAL_HEADER_FILL;
        c.border    = THIN_BORDER;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      ws.getColumn(colB).width = 22;
      ws.getColumn(colC).width = 10;
    });

    pr += 1 + 1 + maxDataRows + 2;
  }
}


// ── 메인 핸들러 ───────────────────────────────────────────────────
const exportDf = async (req, res) => {
  try {
    const { project_id, item_type_id, manufacturer, state, keyword } = req.query;

    const where = {};
    if (project_id)   where.project_id    = project_id;
    if (item_type_id) where.asset_type_id = item_type_id;
    if (manufacturer) where.manufacturer  = { [Op.like]: `%${manufacturer}%` };
    if (state)        where.state         = state;
    if (keyword) {
      where[Op.or] = [
        { model_number:  { [Op.like]: `%${keyword}%` } },
        { serial_number: { [Op.like]: `%${keyword}%` } },
        { location:      { [Op.like]: `%${keyword}%` } },
        { remarks:       { [Op.like]: `%${keyword}%` } },
      ];
    }

    const items = await AssetProjectItem.findAll({
      where,
      include: [
        { model: AssetProject, as: 'project', attributes: ['id', 'name'] },
        {
          model: AssetProjectItemType,
          as: 'item_type',
          attributes: ['id', 'name', 'parent_id'],
          include: [{
            model: AssetProjectItemType,
            as: 'parent',
            attributes: ['id', 'name'],
          }],
        },
      ],
      order: [['project_id', 'ASC'], ['item_number', 'ASC']],
    });

    if (items.length === 0) {
      return res.status(404).json({ message: '내보낼 데이터가 없습니다.' });
    }

    const groupedForTotal  = {};
    const groupedForSheets = {};
    const projectIdMap = {};

    items.forEach((item) => {
      const projName  = item.project?.name || 'Unknown';
      const sheetType = resolveSheetType(item);

      if (!Object.prototype.hasOwnProperty.call(groupedForTotal, projName)) {
        groupedForTotal[projName] = [];
        projectIdMap[projName]    = item.project_id; // 프로젝트 ID 기록
      }
  if (!Object.prototype.hasOwnProperty.call(groupedForSheets, projName))  groupedForSheets[projName] = { PC: [], PLC: [] };

      groupedForTotal[projName].push(item);
      groupedForSheets[projName][sheetType].push(item);
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TAMS';
    wb.created = new Date();

    buildTotalSheet(wb, groupedForTotal);

    // 프로젝트별 전체 반납 여부 판별 (groupedForTotal 기준)
    // 반납 자산이 state 쿼리 없이 포함된 export에서 프로젝트 내 모든 자산이
    // returned이면 시트 탭을 빨간색으로 표시
    const allReturnedProjects = new Set(
      Object.keys(groupedForSheets).filter((projName) => {
        const allItems = groupedForTotal[projName] ?? [];
        return allItems.length > 0 && allItems.every((item) => item.state === 'returned');
      })
    );

    Object.keys(groupedForSheets)
      .sort((a, b) => {
        const isAReturned = allReturnedProjects.has(a);
        const isBReturned = allReturnedProjects.has(b);

        // 1. 반납 상태가 서로 다를 경우: 모두 반납된 프로젝트를 뒤쪽(오른쪽)으로 보냄
        if (isAReturned !== isBReturned) {
          return isAReturned ? 1 : -1; 
        }

        // 2. 반납 상태가 같을 경우: 기존처럼 이름순(가나다순)으로 정렬
        return (projectIdMap[a] ?? 0) - (projectIdMap[b] ?? 0);
      })
      .forEach((projName) => {
        const { PC: pcItems, PLC: plcItems } = groupedForSheets[projName];
        const hasBoth       = pcItems.length > 0 && plcItems.length > 0;
        const isAllReturned = allReturnedProjects.has(projName);

        if (hasBoth) {
          buildProjectSheet(wb, `${projName}_PC`,  pcItems,  isAllReturned);
          buildProjectSheet(wb, `${projName}_PLC`, plcItems, isAllReturned);
        } else if (pcItems.length > 0) {
          buildProjectSheet(wb, projName, pcItems, isAllReturned);
        } else if (plcItems.length > 0) {
          buildProjectSheet(wb, projName, plcItems, isAllReturned);
        }
      });

    const fileName = `TAMS_DF_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Excel export failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: '엑셀 파일 생성 중 오류가 발생했습니다.' });
    }
  }
};

module.exports = { exportDf };