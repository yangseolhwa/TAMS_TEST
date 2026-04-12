'use strict';

const ExcelJS = require('exceljs');
const { AssetProjectItem, AssetProjectItemType, AssetProject } = require('../models');
const { Op } = require('sequelize');

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

// ── 항목 정렬 (대분류→중분류→소유기관→제조사→규격→취득일) ────────
function sortItems(items) {
  return [...items].sort((a, b) => {
    const pairs = [
      [a.item_type?.parent?.name      ?? '', b.item_type?.parent?.name      ?? ''],
      [a.item_type?.name              ?? '', b.item_type?.name              ?? ''],
      [a.owner_organization           ?? '', b.owner_organization           ?? ''],
      [a.manufacturer                 ?? '', b.manufacturer                 ?? ''],
      [a.spec                         ?? '', b.spec                         ?? ''],
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
// 각 필드의 groupKey에 상위 필드를 누적 포함 → 상위 그룹 안에서만 병합
function applyColumnMerges(ws, dataStartRow, sortedItems) {
  if (sortedItems.length < 2) return;

  const S  = '\x00';
  const gp = (i) => sortedItems[i].item_type?.parent?.name      ?? '';
  const gt = (i) => sortedItems[i].item_type?.name              ?? '';
  const go = (i) => sortedItems[i].owner_organization           ?? '';
  const gm = (i) => sortedItems[i].manufacturer                 ?? '';
  const gs = (i) => sortedItems[i].spec                         ?? '';
  const gd = (i) => formatDate(sortedItems[i].acquisition_date) ?? '';

  const fields = [
    { col: 3,  key: (i) => gp(i) },
    { col: 4,  key: (i) => `${gp(i)}${S}${gt(i)}` },
    { col: 5,  key: (i) => `${gp(i)}${S}${gt(i)}${S}${go(i)}` },
    { col: 7,  key: (i) => `${gp(i)}${S}${gt(i)}${S}${go(i)}${S}${gm(i)}` },
    { col: 10, key: (i) => `${gp(i)}${S}${gt(i)}${S}${go(i)}${S}${gm(i)}${S}${gs(i)}` },
    { col: 11, key: (i) => `${gp(i)}${S}${gt(i)}${S}${go(i)}${S}${gm(i)}${S}${gs(i)}${S}${gd(i)}` },
  ];

  for (const { col, key } of fields) {
    let groupStart = 0;
    for (let i = 1; i <= sortedItems.length; i++) {
      const prevKey = key(groupStart);
      const currKey = i < sortedItems.length ? key(i) : null;
      if (i === sortedItems.length || prevKey !== currKey) {
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

// ── project 시트 빌드 ─────────────────────────────────────────────
// 헤더 순서: number | 대분류 | 중분류 | owner_organization | equipment_number
//           | manufacturer | model_name | serial_number | spec
//           | acquisition_date | return_date | state | location | remarks
const PROJ_HEADERS    = [
  'number', '대분류', '중분류', 'owner_organization', 'equipment_number',
  'manufacturer', 'model_name', 'serial_number', 'spec',
  'acquisition_date', 'return_date', 'state', 'location', 'remarks',
];
const PROJ_COL_WIDTHS = [10, 14, 14, 20, 18, 16, 18, 20, 16, 16, 16, 12, 18, 20];

function buildProjectSheet(wb, sheetName, rawItems) {
  const ws             = wb.addWorksheet(sheetName);
  const DATA_START_ROW = 3;

  ws.getColumn(1).width = 9;
  PROJ_HEADERS.forEach((_, i) => { ws.getColumn(i + 2).width = PROJ_COL_WIDTHS[i]; });
  ws.getRow(1).height = 15;

  // 헤더 행
  const headerRow = ws.getRow(2);
  PROJ_HEADERS.forEach((h, i) => {
    const cell     = headerRow.getCell(i + 2);
    cell.value     = h;
    cell.font      = FONT_HEADER;
    cell.fill      = PROJ_HEADER_FILL;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 30;

  // 정렬 후 데이터 행 작성
  const items = sortItems(rawItems);
  items.forEach((item, idx) => {
    const row    = ws.getRow(DATA_START_ROW + idx);
    const values = [
      idx + 1,
      item.item_type?.parent?.name      || '-',
      item.item_type?.name              || '-',
      item.owner_organization           || '-',
      item.equipment_number             || '-',
      item.manufacturer                 || '-',
      item.model_name                   || '-',
      item.serial_number                || '-',
      item.spec                         || '-',
      formatDate(item.acquisition_date) || '-',
      formatDate(item.return_date)      || '-',
      item.state                        || '-',
      item.location                     || '-',
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

  // 병합: 대분류 / 중분류 / 소유기관 / 제조사 / 규격 / 취득일
  applyColumnMerges(ws, DATA_START_ROW, items);
}


// ── TOTAL 시트 빌드 ───────────────────────────────────────────────
// 레이아웃:
//   col B-D  : Total 요약 테이블 (row 1 ~)
//   col F 이후: 프로젝트 블록들 (row 1 ~, 3개씩 가로 배치)
//
const PROJ_BLOCK_START_COL = 6;  // F열
const PROJ_BLOCK_WIDTH     = 3;  // 블록 1개 = 데이터 2열 + 간격 1열
const PROJS_PER_ROW        = 3;

function buildTotalSheet(wb, grouped) {
  const ws           = wb.getWorksheet('TOTAL') || wb.addWorksheet('TOTAL');
  const projectNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ko'));

  // ── Total 테이블 (col B-D, row 1부터) ────────────────────────
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

  // 제목
  ws.mergeCells(tr, TC_B, tr, TC_D);
  const titleCell     = ws.getRow(tr).getCell(TC_B);
  titleCell.value     = 'Total';
  titleCell.font      = FONT_TITLE;
  titleCell.fill      = TOTAL_TITLE_FILL;
  titleCell.border    = THIN_BORDER;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(tr).height = 28;
  tr++;

  // 헤더
  ['대분류', '중분류', '수량'].forEach((h, i) => {
    const cell     = ws.getRow(tr).getCell(TC_B + i);
    cell.value     = h;
    cell.font      = FONT_TOTAL_HDR;
    cell.fill      = TOTAL_SUMMARY_HDR_FILL;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(tr).height = 24;
  tr++;

  // 데이터 행
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

  // 합계 행
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

  // 대분류 병합 (Total 테이블 내)
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

  // Total 테이블 컬럼 너비
  ws.getColumn(TC_B).width = 16;
  ws.getColumn(TC_C).width = 16;
  ws.getColumn(TC_D).width = 10;

  // ── 프로젝트 블록 (col F 이후, row 1부터 가로 배치) ──────────
  let pr = 1;

  for (let blockStart = 0; blockStart < projectNames.length; blockStart += PROJS_PER_ROW) {
    const chunk = projectNames.slice(blockStart, blockStart + PROJS_PER_ROW);

    const summaries = chunk.map((name) => {
      const typeCount = {};
      grouped[name].forEach((item) => {
        const t = item.item_type?.name || '-';
        typeCount[t] = (typeCount[t] || 0) + 1;
      });
      return Object.entries(typeCount).sort(([a], [b]) => a.localeCompare(b, 'ko'));
    });
    const maxDataRows = Math.max(...summaries.map((s) => s.length));

    chunk.forEach((projName, ci) => {
      const colB = PROJ_BLOCK_START_COL + ci * PROJ_BLOCK_WIDTH;
      const colC = colB + 1;

      // 프로젝트명
      ws.mergeCells(pr, colB, pr, colC);
      const nameCell     = ws.getRow(pr).getCell(colB);
      nameCell.value     = projName;
      nameCell.font      = FONT_PROJ_NAME;
      nameCell.fill      = TOTAL_PROJ_NAME_FILL;
      nameCell.border    = THIN_BORDER;
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // 헤더
      const hB = ws.getRow(pr + 1).getCell(colB);
      const hC = ws.getRow(pr + 1).getCell(colC);
      hB.value = '중분류';
      hC.value = '수량';
      [hB, hC].forEach((c) => {
        c.font      = FONT_HEADER;
        c.fill      = TOTAL_HEADER_FILL;
        c.border    = THIN_BORDER;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // 데이터
      summaries[ci].forEach(([typeName, cnt], di) => {
        const dB  = ws.getRow(pr + 2 + di).getCell(colB);
        const dC  = ws.getRow(pr + 2 + di).getCell(colC);
        dB.value  = typeName;
        dC.value  = cnt;
        [dB, dC].forEach((c) => {
          c.font      = FONT_BASE;
          c.border    = THIN_BORDER;
          c.alignment = { vertical: 'middle' };
        });
      });

      ws.getColumn(colB).width = 18;
      ws.getColumn(colC).width = 10;
    });

    pr += 1 + 1 + maxDataRows + 2;
  }
}


// ── 메인 핸들러 ───────────────────────────────────────────────────
const exportDf = async (req, res) => {
  try {
    const { project_id, item_type_id, manufacturer, state, keyword } = req.query;

    const where = { state: { [Op.ne]: 'returned' } };
    if (project_id)   where.project_id    = project_id;
    if (item_type_id) where.asset_type_id = item_type_id;
    if (manufacturer) where.manufacturer  = { [Op.like]: `%${manufacturer}%` };
    if (state)        where.state         = state;
    if (keyword) {
      where[Op.or] = [
        { model_name:    { [Op.like]: `%${keyword}%` } },
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

    const grouped = {};
    items.forEach((item) => {
      const name = item.project?.name || 'Unknown';
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(item);
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TAMS';
    wb.created = new Date();

    buildTotalSheet(wb, grouped);

    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .forEach(([projName, projItems]) => {
        buildProjectSheet(wb, projName, projItems);
      });

    const fileName = `TAMS_DF_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: '엑셀 파일 생성 중 오류가 발생했습니다.' });
    }
  }
};

module.exports = { exportDf };