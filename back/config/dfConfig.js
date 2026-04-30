'use strict';
 
/**
 * PLC 자산으로 분류할 Item 키워드 목록
 * - Import: 시트 내 Item 컬럼값 중 하나라도 매칭되면 해당 시트를 PLC로 판별
 * - Export: item_type.parent.name 없을 때 item_type.name으로 PLC 판별
 *
 */
const PLC_ITEM_KEYWORDS = new Set([
  'NI-D23Q',
  'NI-D43Q',
  'NQ-D23Q',
  'NQ-D43Q',
  'NQ-A24Q',
  'NAD8-3Q',
  'NADF-1Q',
  'NRD8-1Q',
  'NTC8-1Q',
  'NDA8-2Q',
  'NSPS-2Q',
  'NFD1-5Q',
  'NFD1-6Q',
  'NFD1S-1Q',
  'NFD2-1Q',
  'NLBE-1Q',
  'NLBE-2Q',
  'NCPU-2Q'
]);
 
module.exports = { PLC_ITEM_KEYWORDS };