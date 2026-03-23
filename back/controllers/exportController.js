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

// project 시트 헤더 (테마 컬러 → 실제 엑셀에서 흰 배경처럼 보이는 theme:2)
const PROJ_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
// TOTAL 헤더 (rgb: DAE3F3)
const TOTAL_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
// TOTAL 프로젝트명 행 배경
const TOTAL_PROJ_NAME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

const FONT_BASE = { name: '맑은 고딕', size: 11 };
const FONT_HEADER = { ...FONT_BASE, bold: true };
const FONT_PROJ_NAME = { ...FONT_BASE, bold: true, color: { argb: 'FFFFFFFF' } };

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}


// ── project 시트 빌드 ─────────────────────────────────────────────
const PROJ_HEADERS = [
  'number', 'doosan_item_number', 'asset_type', 'manufacturer',
  'model_name', 'serial_number', 'spec', 'quantity',
  'rental_date', 'return_date', 'state', 'location', 'remarks',
];

// 컬럼 너비 (B~N, 인덱스 0=B)
// B:number, C:doosan_item_number, D:asset_type, E:manufacturer, F:model_name,
// G:serial_number, H:spec, I:quantity, J:rental_date, K:return_date, L:state, M:location, N:remarks
const PROJ_COL_WIDTHS = [10, 24, 14, 16, 18, 20, 16, 10, 14, 14, 12, 18, 20];

function buildProjectSheet(wb, sheetName, items) {
  const ws = wb.addWorksheet(sheetName);

  // A열 너비 (여백용)
  ws.getColumn(1).width = 9;

  // B~N 컬럼 너비 설정
  PROJ_HEADERS.forEach((_, i) => {
    ws.getColumn(i + 2).width = PROJ_COL_WIDTHS[i];
  });

  // 1행: 빈 행
  ws.getRow(1).height = 15;

  // 2행: 헤더
  const headerRow = ws.getRow(2);
  PROJ_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 2); // B=2
    cell.value = h;
    cell.font = FONT_HEADER;
    cell.fill = PROJ_HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 30;

  // 3행~: 데이터
  items.forEach((item, idx) => {
    const dataRow = ws.getRow(idx + 3);
    const values = [
      idx + 1,
      item.doosan_item_number || '-',
      item.item_type?.name   || '-',
      item.manufacturer      || '-',
      item.model_name        || '-',
      item.serial_number     || '-',
      item.spec              || '-',
      item.quantity,
      formatDate(item.rental_start_date) || '-',
      formatDate(item.rental_end_date)   || '-',
      item.state             || '-',
      item.location          || '-',
      item.remarks           || '-',
    ];
    values.forEach((v, i) => {
      const cell = dataRow.getCell(i + 2);
      cell.value = v;
      cell.font = FONT_BASE;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle' };
    });
    dataRow.height = 35;
  });
}

// ── TOTAL 시트 빌드 ───────────────────────────────────────────────
// 레이아웃: 프로젝트 3개씩 가로 배치
// 각 블록 너비: 2컬럼(asset_type+quantity) + 1컬럼 여백 = 3
// 시작 컬럼: B(2), E(5), H(8) → 블록별 +3
const TOTAL_BLOCK_WIDTH = 3;  // 2 data cols + 1 gap
const PROJS_PER_ROW = 3;

function buildTotalSheet(wb, grouped) {
  const ws = wb.getWorksheet('TOTAL') || wb.addWorksheet('TOTAL');

  const projectNames = Object.keys(grouped).sort();
  let curRow = 1; // 현재 쓰기 시작 행

  for (let blockStart = 0; blockStart < projectNames.length; blockStart += PROJS_PER_ROW) {
    const chunk = projectNames.slice(blockStart, blockStart + PROJS_PER_ROW);

    // 각 블록의 최대 데이터 행 수 계산 (asset_type별 집계)
    const summaries = chunk.map((name) => {
      const typeCount = {};
      grouped[name].forEach((item) => {
        const t = item.item_type?.name || '-';
        typeCount[t] = (typeCount[t] || 0) + item.quantity;
      });
      return Object.entries(typeCount).sort(([a], [b]) => a.localeCompare(b));
    });
    const maxDataRows = Math.max(...summaries.map((s) => s.length));

    chunk.forEach((projName, ci) => {
      const colB = 2 + ci * TOTAL_BLOCK_WIDTH; // B=2, E=5, H=8
      const colC = colB + 1;

      // ── 프로젝트명 행 (병합) ──
      const nameCell = ws.getRow(curRow).getCell(colB);
      nameCell.value = projName;
      nameCell.font = FONT_PROJ_NAME;
      nameCell.fill = TOTAL_PROJ_NAME_FILL;
      nameCell.border = THIN_BORDER;
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(curRow, colB, curRow, colC);

      // ── 헤더 행 ──
      const hRowIdx = curRow + 1;
      const hB = ws.getRow(hRowIdx).getCell(colB);
      const hC = ws.getRow(hRowIdx).getCell(colC);
      hB.value = 'asset_type';
      hC.value = 'quantity';
      [hB, hC].forEach((c) => {
        c.font = FONT_HEADER;
        c.fill = TOTAL_HEADER_FILL;
        c.border = THIN_BORDER;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // ── 데이터 행 ──
      summaries[ci].forEach(([typeName, qty], di) => {
        const dRowIdx = curRow + 2 + di;
        const dB = ws.getRow(dRowIdx).getCell(colB);
        const dC = ws.getRow(dRowIdx).getCell(colC);
        dB.value = typeName;
        dC.value = qty;
        [dB, dC].forEach((c) => {
          c.font = FONT_BASE;
          c.border = THIN_BORDER;
          c.alignment = { vertical: 'middle' };
        });
      });

      // 컬럼 너비 설정
      ws.getColumn(colB).width = 18;
      ws.getColumn(colC).width = 10;
    });

    // 다음 블록 시작 행 = 프로젝트명(1) + 헤더(1) + 데이터(maxDataRows) + 여백(2)
    curRow += 1 + 1 + maxDataRows + 2;
  }
}

// ── 메인 핸들러 ───────────────────────────────────────────────────
const exportDf = async (req, res) => {
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
      { model: AssetProject,         as: 'project',  attributes: ['id', 'name'] },
      { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name'] },
    ],
    order: [['project_id', 'ASC'], ['item_number', 'ASC']],
  });

  if (items.length === 0) {
    return res.status(404).json({ message: '내보낼 데이터가 없습니다.' });
  }

  // 프로젝트별 그룹핑
  const grouped = {};
  items.forEach((item) => {
    const name = item.project?.name || 'Unknown';
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(item);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'TAMS';
  wb.created = new Date();

  // 1) TOTAL 시트
  wb.addWorksheet('TOTAL');
  buildTotalSheet(wb, grouped);

  // 2) 프로젝트별 시트
  Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([projName, projItems]) => {
      buildProjectSheet(wb, projName, projItems);
    });

  const fileName = `TAMS_DF_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  await wb.xlsx.write(res);
  res.end();
};

module.exports = { exportDf };