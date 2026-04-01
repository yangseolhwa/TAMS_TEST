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

const PROJ_HEADER_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const TOTAL_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
const TOTAL_PROJ_NAME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

const FONT_BASE      = { name: '맑은 고딕', size: 11 };
const FONT_HEADER    = { ...FONT_BASE, bold: true };
const FONT_PROJ_NAME = { ...FONT_BASE, bold: true, color: { argb: 'FFFFFFFF' } };

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}


// ── project 시트 빌드 ─────────────────────────────────────────────
// 헤더 순서: number, asset_type, owner_organization, equipment_number,
//           manufacturer, model_name, serial_number, spec,
//           acquisition_date, return_date, state, location, remarks
const PROJ_HEADERS = [
  'number', 'asset_type', 'owner_organization', 'equipment_number',
  'manufacturer', 'model_name', 'serial_number', 'spec',
  'acquisition_date', 'return_date', 'state', 'location', 'remarks',
];

const PROJ_COL_WIDTHS = [10, 14, 20, 18, 16, 18, 20, 16, 16, 16, 12, 18, 20];

function buildProjectSheet(wb, sheetName, items) {
  const ws = wb.addWorksheet(sheetName);

  ws.getColumn(1).width = 9; // A열 여백

  PROJ_HEADERS.forEach((_, i) => {
    ws.getColumn(i + 2).width = PROJ_COL_WIDTHS[i];
  });

  ws.getRow(1).height = 15;

  const headerRow = ws.getRow(2);
  PROJ_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 2);
    cell.value = h;
    cell.font  = FONT_HEADER;
    cell.fill  = PROJ_HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 30;

  items.forEach((item, idx) => {
    const dataRow = ws.getRow(idx + 3);
    const values = [
      idx + 1,
      item.item_type?.name      || '-',
      item.owner_organization   || '-',
      item.equipment_number     || '-',
      item.manufacturer         || '-',
      item.model_name           || '-',
      item.serial_number        || '-',
      item.spec                 || '-',
      formatDate(item.acquisition_date) || '-',
      formatDate(item.return_date)      || '-',
      item.state                || '-',
      item.location             || '-',
      item.remarks              || '-',
    ];
    values.forEach((v, i) => {
      const cell = dataRow.getCell(i + 2);
      cell.value = v;
      cell.font  = FONT_BASE;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle' };
    });
    dataRow.height = 35;
  });
}


// ── TOTAL 시트 빌드 ───────────────────────────────────────────────
const TOTAL_BLOCK_WIDTH = 3;
const PROJS_PER_ROW     = 3;

function buildTotalSheet(wb, grouped) {
  const ws = wb.getWorksheet('TOTAL') || wb.addWorksheet('TOTAL');

  const projectNames = Object.keys(grouped).sort();
  let curRow = 1;

  for (let blockStart = 0; blockStart < projectNames.length; blockStart += PROJS_PER_ROW) {
    const chunk = projectNames.slice(blockStart, blockStart + PROJS_PER_ROW);

    const summaries = chunk.map((name) => {
      const typeCount = {};
      grouped[name].forEach((item) => {
        const t = item.item_type?.name || '-';
        typeCount[t] = (typeCount[t] || 0) + 1; // quantity 제거 → 건수로 집계
      });
      return Object.entries(typeCount).sort(([a], [b]) => a.localeCompare(b));
    });
    const maxDataRows = Math.max(...summaries.map((s) => s.length));

    chunk.forEach((projName, ci) => {
      const colB = 2 + ci * TOTAL_BLOCK_WIDTH;
      const colC = colB + 1;

      const nameCell = ws.getRow(curRow).getCell(colB);
      nameCell.value = projName;
      nameCell.font  = FONT_PROJ_NAME;
      nameCell.fill  = TOTAL_PROJ_NAME_FILL;
      nameCell.border = THIN_BORDER;
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(curRow, colB, curRow, colC);

      const hRowIdx = curRow + 1;
      const hB = ws.getRow(hRowIdx).getCell(colB);
      const hC = ws.getRow(hRowIdx).getCell(colC);
      hB.value = 'asset_type';
      hC.value = 'count';
      [hB, hC].forEach((c) => {
        c.font  = FONT_HEADER;
        c.fill  = TOTAL_HEADER_FILL;
        c.border = THIN_BORDER;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      summaries[ci].forEach(([typeName, cnt], di) => {
        const dRowIdx = curRow + 2 + di;
        const dB = ws.getRow(dRowIdx).getCell(colB);
        const dC = ws.getRow(dRowIdx).getCell(colC);
        dB.value = typeName;
        dC.value = cnt;
        [dB, dC].forEach((c) => {
          c.font  = FONT_BASE;
          c.border = THIN_BORDER;
          c.alignment = { vertical: 'middle' };
        });
      });

      ws.getColumn(colB).width = 18;
      ws.getColumn(colC).width = 10;
    });

    curRow += 1 + 1 + maxDataRows + 2;
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
        { model: AssetProject,         as: 'project',   attributes: ['id', 'name'] },
        { model: AssetProjectItemType, as: 'item_type', attributes: ['id', 'name'] },
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
      .sort(([a], [b]) => a.localeCompare(b))
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