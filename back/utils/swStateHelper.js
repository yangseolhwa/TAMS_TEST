'use strict';

/**
 * SW 마스터 state 재계산 헬퍼
 *
 * ── 변경 전 로직 ──────────────────────────────────────────────────
 *   inUseCount > 0  → 'in_use'
 *   inUseCount === 0 → 'available'
 *   문제: 10개 중 1개만 사용 중이어도 'in_use' → 할당 가능 여부를 state로 판단 불가
 *
 * ── 변경 후 로직 ──────────────────────────────────────────────────
 *   inUseCount >= sw.quantity → 'in_use'  (모두 사용 중)
 *   inUseCount <  sw.quantity → 'available' (여유 슬롯 있음)
 *   sw.quantity === 0 → 'available' (capacity 미설정, 할당 불가 판별 불가)
 *
 *   라이선스형: sw.quantity = 총 라이선스 capacity (등록 시 pre-set)
 *   구독형   : sw.quantity = 총 자리 수 (add_quantity로 관리)
 *   → 두 타입 모두 동일 로직으로 처리
 */

const { Op }                        = require('sequelize');
const sequelize                     = require('../config/db');
const { AssetSw, AssetSwLicense }   = require('../models');

// ─────────────────────────────────────────────────────────────────
// 단일 SW state 재계산
// ─────────────────────────────────────────────────────────────────
/**
 * @param {number}      swId  asset_sw.id
 * @param {object|null} t     Sequelize transaction (없으면 null)
 */
async function recalcSwState(swId, t) {
  const opts = t ? { transaction: t } : {};

  const sw = await AssetSw.findByPk(swId, opts);
  if (!sw || sw.state === 'returned') return;   // 반납된 SW는 건너뜀

  const inUseCount = await AssetSwLicense.count({
    where: { asset_sw_id: swId, state: 'in_use' },
    ...opts,
  });

  // quantity=0이면 capacity 미설정 → available 유지
  const newState = (sw.quantity > 0 && inUseCount >= sw.quantity)
    ? 'in_use'
    : 'available';

  if (sw.state !== newState) {
    await sw.update({ state: newState }, opts);
  }
}

// ─────────────────────────────────────────────────────────────────
// 여러 SW state 일괄 재계산 (returnSw / changeSwState 배치용)
// GROUP BY 단일 쿼리로 처리 → N+1 방지
// ─────────────────────────────────────────────────────────────────
/**
 * @param {number[]}    swIds  asset_sw.id 배열
 * @param {object|null} t      Sequelize transaction
 */
async function recalcSwStateBatch(swIds, t) {
  if (!swIds || swIds.length === 0) return;
  const opts = t ? { transaction: t } : {};

  // returned 제외한 SW 조회 (quantity 기준 필요)
  const sws = await AssetSw.findAll({
    where: { id: { [Op.in]: swIds }, state: { [Op.ne]: 'returned' } },
    attributes: ['id', 'quantity', 'state'],
    ...opts,
  });
  if (sws.length === 0) return;

  const activeIds   = sws.map(s => s.id);
  const quantityMap = Object.fromEntries(sws.map(s => [s.id, s.quantity]));

  // in_use 라이선스 수를 GROUP BY로 한 번에 조회
  const countRows = await AssetSwLicense.findAll({
    where: { asset_sw_id: { [Op.in]: activeIds }, state: 'in_use' },
    attributes: [
      'asset_sw_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'cnt'],
    ],
    group: ['asset_sw_id'],
    raw:   true,
    ...opts,
  });

  const inUseMap = Object.fromEntries(
    countRows.map(r => [Number(r.asset_sw_id), parseInt(r.cnt, 10)])
  );

  const toInUse    = [];
  const toAvailable = [];

  for (const sw of sws) {
    const qty    = quantityMap[sw.id] ?? 0;
    const used   = inUseMap[sw.id]   ?? 0;
    const newState = (qty > 0 && used >= qty) ? 'in_use' : 'available';
    if (newState === 'in_use') toInUse.push(sw.id);
    else                       toAvailable.push(sw.id);
  }

  if (toInUse.length > 0) {
    await AssetSw.update(
      { state: 'in_use' },
      { where: { id: { [Op.in]: toInUse } }, ...opts }
    );
  }
  if (toAvailable.length > 0) {
    await AssetSw.update(
      { state: 'available' },
      { where: { id: { [Op.in]: toAvailable } }, ...opts }
    );
  }
}

module.exports = { recalcSwState, recalcSwStateBatch };