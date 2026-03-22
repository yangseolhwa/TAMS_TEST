'use strict';
require('dotenv').config();

/**
 * TAMS 시드 데이터
 * 실행: node seeders/seed.js  (또는 node seed.js — 파일 위치에 맞게)
 *
 * 핵심 비즈니스 규칙 반영
 * ┌─────────┬─────────────────────────────────────────────────────────────┐
 * │ admin   │ 자산 직접 등록(즉시 active) / 직접 반납(즉시 returned)      │
 * │         │ → AssetEnterpriseRequest / AssetSwRequest 에                │
 * │         │   register 레코드 생성 안 함                                │
 * │         │   return  레코드는 컨트롤러가 히스토리용으로 자동 생성      │
 * │ user    │ 등록 → pending 요청 → admin 승인/거절                       │
 * │         │ 반납 → 즉시 처리 + approved 히스토리 레코드 자동 생성       │
 * └─────────┴─────────────────────────────────────────────────────────────┘
 *
 * 생성 데이터
 * ├── users                       19명 (admin 2, user 17)
 * ├── asset_enterprise_category    3개
 * ├── asset_enterprise_item_type   5개
 * ├── asset_enterprise            16개 (active 8 / inactive 2 / stored 2 / returned 4)
 * ├── asset_enterprise_request    10개 (pending 3 / approved 3 / rejected 1 / return 히스토리 4)
 * ├── asset_sw                     5개
 * ├── asset_sw_license            14개 (active 11 / returned 3)
 * ├── asset_sw_request             6개 (pending 3 / approved 1 / rejected 1 / return 히스토리 1)
 * ├── asset_project                2개
 * ├── asset_project_item_type      3개
 * ├── asset_project_item          14개 (active 7 / stored 2 / rented 2 / returned 3)
 * └── asset_project_history       10개 (register 4 / move 3 / return 3)
 */

const sequelize = require('./config/db');
const {
  User,
  AssetEnterpriseCategory,
  AssetEnterpriseItemType,
  AssetEnterprise,
  AssetEnterpriseRequest,
  AssetSw,
  AssetSwLicense,
  AssetSwRequest,
  AssetProject,
  AssetProjectItemType,
  AssetProjectItem,
  AssetProjectHistory,
} = require('./models');

async function seed() {
  await sequelize.authenticate();
  console.log('✅ DB 연결 성공');

  // ── FK 체크 해제 후 전체 truncate ────────────────────────────────────────
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of [
    'asset_project_history', 'asset_project_item', 'asset_project_item_type',
    'asset_project', 'asset_sw_request', 'asset_sw_license', 'asset_sw',
    'asset_enterprise_request', 'asset_enterprise',
    'asset_enterprise_item_type', 'asset_enterprise_category', 'users',
  ]) {
    await sequelize.query(`TRUNCATE TABLE \`${t}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('🗑️  기존 데이터 초기화 완료');

  // ── 1. Users ─────────────────────────────────────────────────────────────
  const users = await User.bulkCreate([
    { email: 'ghkim@tbog.co.kr',    role: 'admin' }, 
    { email: 'shyang@tbog.co.kr',   role: 'admin' }, 
    { email: 'iskra@tbog.co.kr',    role: 'user'  }, 
    { email: 'younghuh@tbog.co.kr', role: 'user'  }, 
    { email: 'eypark@tbog.co.kr',   role: 'user'  }, 
    { email: 'yjpark@tbog.co.kr',   role: 'user'  }, 
    { email: 'kbyoo1@tbog.co.kr',   role: 'user'  },
    { email: 'mkseo@tbog.co.kr',    role: 'user'  },
    { email: 'msjin@tbog.co.kr',    role: 'user'  },
    { email: 'kphong@tbog.co.kr',   role: 'user'  },
    { email: 'sjhan@tbog.co.kr',    role: 'user'  }, 
    { email: 'jcpark@tbog.co.kr',   role: 'user'  }, 
    { email: 'jdkim@tbog.co.kr',    role: 'user'  }, 
    { email: 'ghlee@tbog.co.kr',    role: 'user'  }, 
    { email: 'hgyang@tbog.co.kr',   role: 'user'  }, 
    { email: 'jylee@tbog.co.kr',    role: 'user'  }, 
    { email: 'hjjin@tbog.co.kr',    role: 'user'  }, 
    { email: 'jhbang@tbog.co.kr',   role: 'user'  }, 
    { email: 'swlee@tbog.co.kr',    role: 'user'  }, 
  ], { returning: true });

  const admin1 = users[0];
  const admin2 = users[1];
  const u1     = users[2];
  const u2     = users[3];
  const u3     = users[4];

  console.log(`👤 Users 생성: ${users.length}명`);

  // ── 2. Enterprise 카테고리 ────────────────────────────────────────────────
  const [catNb, catMon, catNet] = await AssetEnterpriseCategory.bulkCreate([
    { name: '노트북'       },
    { name: '모니터'       },
    { name: '네트워크 장비' },
  ], { returning: true });

  // ── 3. Enterprise 자산 종류 ───────────────────────────────────────────────
  const [typeNb, typeMon, typeSwitch, typeRouter, typeAP] = await AssetEnterpriseItemType.bulkCreate([
    { name: '노트북',  category_id: catNb.id  },
    { name: '모니터',  category_id: catMon.id },
    { name: '스위치',  category_id: catNet.id },
    { name: '라우터',  category_id: catNet.id },
    { name: '무선 AP', category_id: catNet.id },
  ], { returning: true });
  console.log('📂 카테고리 / 종류 생성');

  // ── 4. AssetEnterprise (16개) ─────────────────────────────────────────────
  const ents = await AssetEnterprise.bulkCreate([

    // ─── active: user 소유 5개 (반납·이동 테스트 핵심) ───────────────────
    {
      asset_number: 'NB-2024-001', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'personal', user_id: u1.id,
      model_name: 'GramPro 16', manufacturer: 'LG',
      spec: 'i7 / 16GB / 512GB', serial_number: 'SN-LG-NB-001',
      acquisition_date: '2024-01-10', state: 'active', location: '서울 본사 2층',
    },
    {
      asset_number: 'NB-2024-002', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'personal', user_id: u1.id,
      model_name: 'Latitude 5540', manufacturer: 'Dell',
      spec: 'i5 / 8GB / 256GB', serial_number: 'SN-DELL-NB-001',
      acquisition_date: '2024-02-15', state: 'active', location: '서울 본사 2층',
    },
    {
      asset_number: 'MON-2024-001', category_id: catMon.id, item_type_id: typeMon.id,
      responsible_type: 'personal', user_id: u1.id,
      model_name: '27UL600', manufacturer: 'LG',
      spec: '27인치 4K IPS', serial_number: 'SN-LG-MON-001',
      acquisition_date: '2024-03-01', state: 'active', location: '서울 본사 2층',
    },
    {
      asset_number: 'NB-2024-003', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'personal', user_id: u2.id,
      model_name: 'ThinkPad X1 Carbon', manufacturer: 'Lenovo',
      spec: 'i7 / 16GB / 1TB', serial_number: 'SN-LNV-NB-001',
      acquisition_date: '2024-03-05', state: 'active', location: '부산 지사 1층',
    },
    {
      asset_number: 'MON-2024-002', category_id: catMon.id, item_type_id: typeMon.id,
      responsible_type: 'personal', user_id: u3.id,
      model_name: 'U2722D', manufacturer: 'Dell',
      spec: '27인치 QHD IPS', serial_number: 'SN-DELL-MON-001',
      acquisition_date: '2024-03-10', state: 'active', location: '서울 본사 4층',
    },

    // ─── active: admin 관리 3개 (admin 이동·반납 테스트용) ───────────────
    {
      asset_number: 'NB-2024-004', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'admin', user_id: admin1.id,
      model_name: 'Galaxy Book4 Pro', manufacturer: 'Samsung',
      spec: 'i7 / 16GB / 1TB', serial_number: 'SN-SAM-NB-001',
      acquisition_date: '2024-03-10', state: 'active', location: '서울 본사 3층',
    },
    {
      asset_number: 'SW-2024-001', category_id: catNet.id, item_type_id: typeSwitch.id,
      responsible_type: 'room', user_id: admin1.id,
      model_name: 'SG350-10', manufacturer: 'Cisco',
      spec: '10포트 기가비트', serial_number: 'SN-CISCO-SW-001',
      acquisition_date: '2023-11-01', state: 'active', location: '서버실',
    },
    {
      asset_number: 'RT-2024-001', category_id: catNet.id, item_type_id: typeRouter.id,
      responsible_type: 'room', user_id: admin2.id,
      model_name: 'RV340', manufacturer: 'Cisco',
      spec: '듀얼 WAN', serial_number: 'SN-CISCO-RT-001',
      acquisition_date: '2023-11-01', state: 'active', location: '서버실',
    },

    // ─── inactive 2개 ────────────────────────────────────────────────────
    {
      asset_number: 'NB-2023-001', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'admin', user_id: admin1.id,
      model_name: 'ProBook 450', manufacturer: 'HP',
      spec: 'i5 / 8GB / 256GB', serial_number: 'SN-HP-NB-001',
      acquisition_date: '2023-01-05', state: 'inactive', location: '창고 A',
    },
    {
      asset_number: 'AP-2023-001', category_id: catNet.id, item_type_id: typeAP.id,
      responsible_type: 'admin', user_id: admin2.id,
      model_name: 'WAX630', manufacturer: 'Netgear',
      spec: 'WiFi 6 트라이밴드', serial_number: 'SN-NGR-AP-001',
      acquisition_date: '2023-05-01', state: 'inactive', location: '창고 A',
    },

    // ─── stored 2개 ──────────────────────────────────────────────────────
    {
      asset_number: 'NB-2022-001', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'admin', user_id: admin1.id,
      model_name: 'ThinkPad E15', manufacturer: 'Lenovo',
      spec: 'i5 / 16GB / 512GB', serial_number: 'SN-LNV-NB-002',
      acquisition_date: '2022-06-01', state: 'stored', location: '창고 B',
    },
    {
      asset_number: 'MON-2022-001', category_id: catMon.id, item_type_id: typeMon.id,
      responsible_type: 'admin', user_id: admin2.id,
      model_name: 'S27R750', manufacturer: 'Samsung',
      spec: '27인치 FHD 144Hz', serial_number: 'SN-SAM-MON-001',
      acquisition_date: '2022-09-01', state: 'stored', location: '창고 B',
    },

    // ─── returned 4개 (GET 조회 미노출 확인용) ───────────────────────────
    // user 반납 2건
    {
      asset_number: 'NB-2021-001', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'admin', user_id: u1.id,
      model_name: 'MacBook Pro 14', manufacturer: 'Apple',
      spec: 'M1 Pro / 16GB', serial_number: 'SN-APL-NB-001',
      acquisition_date: '2021-01-01', return_date: '2024-01-15',
      state: 'returned', location: null,
    },
    {
      asset_number: 'MON-2021-001', category_id: catMon.id, item_type_id: typeMon.id,
      responsible_type: 'admin', user_id: u2.id,
      model_name: 'S24F350', manufacturer: 'Samsung',
      spec: '24인치 FHD', serial_number: 'SN-SAM-MON-002',
      acquisition_date: '2021-03-01', return_date: '2024-02-20',
      state: 'returned', location: null,
    },
    // admin 직접 반납 2건
    {
      asset_number: 'NB-2020-001', category_id: catNb.id, item_type_id: typeNb.id,
      responsible_type: 'admin', user_id: admin1.id,
      model_name: 'Surface Laptop 5', manufacturer: 'Microsoft',
      spec: 'i5 / 8GB / 256GB', serial_number: 'SN-MS-NB-001',
      acquisition_date: '2020-06-01', return_date: '2024-03-01',
      state: 'returned', location: null,
    },
    {
      asset_number: 'SW-2020-001', category_id: catNet.id, item_type_id: typeSwitch.id,
      responsible_type: 'admin', user_id: admin2.id,
      model_name: 'WS-C2960X', manufacturer: 'Cisco',
      spec: '24포트 기가비트', serial_number: 'SN-CISCO-SW-002',
      acquisition_date: '2020-01-15', return_date: '2024-03-10',
      state: 'returned', location: null,
    },
  ], { returning: true });
  console.log('🖥️  AssetEnterprise 생성:', ents.length, '개');

  // 변수 alias
  const [
    entU1_NB1, entU1_NB2, entU1_MON,    // [0~2] u1 소유 active
    entU2_NB,  entU3_MON,               // [3~4] u2/u3 소유 active
    entAdm_NB, entAdm_SW, entAdm_RT,    // [5~7] admin 관리 active
    /*inactive*/ , ,                    // [8~9]
    /*stored*/   , ,                    // [10~11]
    entRetU1, entRetU2,                 // [12~13] user 반납
    entRetA1, entRetA2,                 // [14~15] admin 반납
  ] = ents;

  // ── 5. AssetEnterpriseRequest ─────────────────────────────────────────────
  //  ✅ user 등록 요청만 (pending/approved/rejected)
  //  ✅ return 히스토리: user 2건 + admin 2건 (컨트롤러 동작 재현)
  //  ❌ admin register 요청 없음
  await AssetEnterpriseRequest.bulkCreate([

    // ── user 신규 등록 pending 2건 ──────────────────────────
    {
      asset_id: null, requester_id: u1.id,
      status: 'pending', request_type: 'register', request_date: new Date(),
      required_quantity: 1, request_reason: '업무용 노트북이 필요합니다.',
      new_asset_data: JSON.stringify({
        asset_number: 'NB-REQ-001', model_name: 'XPS 15',
        category_id: catNb.id, item_type_id: typeNb.id,
        manufacturer: 'Dell', spec: 'i9 / 32GB / 1TB',
        serial_number: null, acquisition_date: '2024-04-01',
      }),
    },
    {
      asset_id: null, requester_id: u2.id,
      status: 'pending', request_type: 'register',
      request_date: new Date(Date.now() - 30 * 60 * 1000),
      required_quantity: 1, request_reason: '재택 근무용 모니터 신청합니다.',
      new_asset_data: JSON.stringify({
        asset_number: 'MON-REQ-001', model_name: '32UN880-B',
        category_id: catMon.id, item_type_id: typeMon.id,
        manufacturer: 'LG', spec: '32인치 4K USB-C',
        serial_number: null, acquisition_date: '2024-04-01',
      }),
    },

    // ── user 기존 자산 기반 pending 1건 ─────────────────────
    {
      asset_id: ents[0].id, requester_id: u3.id,
      status: 'pending', request_type: 'register',
      request_date: new Date(Date.now() - 10 * 60 * 1000),
      required_quantity: 1, request_reason: '동일 모델 추가 배정 요청합니다.',
      new_asset_data: JSON.stringify({
        asset_number: 'NB-REQ-002',
        model_name: ents[0].model_name,
        manufacturer: ents[0].manufacturer,
        spec: null, serial_number: null,
        acquisition_date: '2024-04-01',
      }),
    },

    // ── approved 2건 (24h 이내 → user 조회 노출) ────────────
    {
      asset_id: null, requester_id: u1.id,
      status: 'approved', request_type: 'register',
      request_date: new Date(Date.now() - 3 * 60 * 60 * 1000),
      required_quantity: 1,
      processed_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      new_asset_data: JSON.stringify({
        asset_number: 'NB-APPR-001', model_name: 'MacBook Air M3',
        category_id: catNb.id, item_type_id: typeNb.id,
        manufacturer: 'Apple', spec: 'M3 / 16GB / 512GB',
        serial_number: null, acquisition_date: '2024-03-20',
      }),
    },
    {
      asset_id: null, requester_id: u2.id,
      status: 'approved', request_type: 'register',
      request_date: new Date(Date.now() - 5 * 60 * 60 * 1000),
      required_quantity: 1,
      processed_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
      new_asset_data: JSON.stringify({
        asset_number: 'NB-APPR-002', model_name: 'ZBook Power G10',
        category_id: catNb.id, item_type_id: typeNb.id,
        manufacturer: 'HP', spec: 'i7 / 16GB / 512GB',
        serial_number: null, acquisition_date: '2024-03-22',
      }),
    },

    // ── rejected 1건 (24h 이내 → user 조회 노출) ────────────
    {
      asset_id: null, requester_id: u3.id,
      status: 'rejected', request_type: 'register',
      request_date: new Date(Date.now() - 6 * 60 * 60 * 1000),
      required_quantity: 1,
      admin_reason: '현재 예산 초과로 구매가 어렵습니다.',
      processed_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
      new_asset_data: JSON.stringify({
        asset_number: 'NB-REJ-001', model_name: 'MacBook Pro 16',
        category_id: catNb.id, item_type_id: typeNb.id,
        manufacturer: 'Apple', spec: 'M3 Pro / 36GB / 1TB',
        serial_number: null, acquisition_date: '2024-03-25',
      }),
    },

    // ── return 히스토리 4건 ──────────────────────────────────
    // (returnEnterprise 컨트롤러가 생성하는 레코드 구조 그대로 재현)
    { asset_id: ents[12].id, requester_id: u1.id,     status: 'approved', request_type: 'return', required_quantity: 1, request_date: new Date('2024-01-15'), processed_at: new Date('2024-01-15') },
    { asset_id: ents[13].id, requester_id: u2.id,     status: 'approved', request_type: 'return', required_quantity: 1, request_date: new Date('2024-02-20'), processed_at: new Date('2024-02-20') },
    { asset_id: ents[14].id, requester_id: admin1.id, status: 'approved', request_type: 'return', required_quantity: 1, request_date: new Date('2024-03-01'), processed_at: new Date('2024-03-01') },
    { asset_id: ents[15].id, requester_id: admin2.id, status: 'approved', request_type: 'return', required_quantity: 1, request_date: new Date('2024-03-10'), processed_at: new Date('2024-03-10') },
  ]);
  console.log('📋 AssetEnterpriseRequest 생성');

  // ── 6. AssetSw (5개) ──────────────────────────────────────────────────────
  const [swSlack, swFigma, swWindows, swAdobeCC, swVSCode] = await AssetSw.bulkCreate([
    { name: 'Slack',                software_type: 'collaboration', manufacturer: 'Salesforce', is_subscription: true,  state: 'active' },
    { name: 'Figma',                software_type: 'design',        manufacturer: 'Figma Inc',  is_subscription: true,  state: 'active' },
    { name: 'Windows 11 Pro',       software_type: 'other',         manufacturer: 'Microsoft',  is_subscription: false, state: 'active' },
    { name: 'Adobe Creative Cloud', software_type: 'design',        manufacturer: 'Adobe',      is_subscription: true,  state: 'active' },
    { name: 'VS Code (Enterprise)', software_type: 'dev',           manufacturer: 'Microsoft',  is_subscription: false, state: 'active' },
  ], { returning: true });
  console.log('💿 AssetSw 생성');

  // ── 7. AssetSwLicense (14개) ──────────────────────────────────────────────
  const licenses = await AssetSwLicense.bulkCreate([
    // Slack × 4 (u1·u2·u3·admin1)
    { asset_sw_id: swSlack.id, user_id: u1.id,     license_key: 'SLACK-0001', key_type: 'serial', subscription_date: '2024-01-01', state: 'active',   location: null },
    { asset_sw_id: swSlack.id, user_id: u2.id,     license_key: 'SLACK-0002', key_type: 'serial', subscription_date: '2024-01-01', state: 'active',   location: null },
    { asset_sw_id: swSlack.id, user_id: u3.id,     license_key: 'SLACK-0003', key_type: 'serial', subscription_date: '2024-01-01', state: 'active',   location: null },
    { asset_sw_id: swSlack.id, user_id: admin1.id,  license_key: 'SLACK-0004', key_type: 'serial', subscription_date: '2024-01-01', state: 'active',   location: null },

    // Figma × 3 (u1·u2 active / u3 returned → 조회 미노출)
    { asset_sw_id: swFigma.id, user_id: u1.id, license_key: 'FIG-0001', key_type: 'url', related_link: 'https://figma.com', subscription_date: '2024-02-01', state: 'active',   location: null },
    { asset_sw_id: swFigma.id, user_id: u2.id, license_key: 'FIG-0002', key_type: 'url', related_link: 'https://figma.com', subscription_date: '2024-02-01', state: 'active',   location: null },
    { asset_sw_id: swFigma.id, user_id: u3.id, license_key: 'FIG-0003', key_type: 'url', related_link: 'https://figma.com', subscription_date: '2023-02-01', state: 'returned', location: null },

    // Windows 11 × 4 — USB 물리 보관, location 있음 (SW 이동 테스트 핵심)
    { asset_sw_id: swWindows.id, user_id: admin1.id, license_key: 'WIN11-0001', key_type: 'serial', subscription_date: '2023-06-01', state: 'active',   location: '서버실 선반 A-01' },
    { asset_sw_id: swWindows.id, user_id: u1.id,     license_key: 'WIN11-0002', key_type: 'serial', subscription_date: '2023-07-01', state: 'active',   location: '서버실 선반 A-02' },
    { asset_sw_id: swWindows.id, user_id: u2.id,     license_key: 'WIN11-0003', key_type: 'serial', subscription_date: '2023-08-01', state: 'active',   location: null              },
    { asset_sw_id: swWindows.id, user_id: u3.id,     license_key: 'WIN11-0004', key_type: 'serial', subscription_date: '2022-01-01', state: 'returned', location: null              },

    // Adobe CC × 2 (u1·admin2)
    { asset_sw_id: swAdobeCC.id, user_id: u1.id,     license_key: 'ADCC-0001', key_type: 'credential', subscription_date: '2024-01-01', state: 'active', location: null },
    { asset_sw_id: swAdobeCC.id, user_id: admin2.id,  license_key: 'ADCC-0002', key_type: 'credential', subscription_date: '2024-01-01', state: 'active', location: null },

    // VS Code × 1
    { asset_sw_id: swVSCode.id, user_id: u2.id, license_key: 'VSC-ENT-0001', key_type: 'serial', subscription_date: '2024-01-01', state: 'active', location: null },
  ], { returning: true });
  console.log('🔑 AssetSwLicense 생성:', licenses.length, '개');

  // ── 8. AssetSwRequest ─────────────────────────────────────────────────────
  //  ✅ user 등록 요청만 (pending/approved/rejected)
  //  ✅ return 히스토리 (컨트롤러 동작 재현)
  //  ❌ admin register 요청 없음
  await AssetSwRequest.bulkCreate([

    // ── user 신규 SW pending ─────────────────────────────────
    {
      asset_sw_id: null, requester_id: u1.id,
      status: 'pending', request_type: 'register', request_date: new Date(),
      required_quantity: 1, request_reason: '개발용 IDE가 필요합니다.',
      new_asset_data: JSON.stringify({
        name: 'JetBrains IntelliJ IDEA', software_type: 'dev',
        manufacturer: 'JetBrains', is_subscription: true,
        license_key: 'IJ-0001', key_type: 'serial',
      }),
    },

    // ── user 기존 SW 기반 pending (Slack 추가) ───────────────
    {
      asset_sw_id: swSlack.id, requester_id: u2.id,
      status: 'pending', request_type: 'register',
      request_date: new Date(Date.now() - 20 * 60 * 1000),
      required_quantity: 1, request_reason: '추가 Slack 라이선스 요청합니다.',
      new_asset_data: JSON.stringify({ license_key: 'SLACK-0010', key_type: 'serial' }),
    },

    // ── user 기존 SW 기반 pending (Figma 추가) ───────────────
    {
      asset_sw_id: swFigma.id, requester_id: u3.id,
      status: 'pending', request_type: 'register',
      request_date: new Date(Date.now() - 40 * 60 * 1000),
      required_quantity: 1, request_reason: 'Figma 추가 라이선스가 필요합니다.',
      new_asset_data: JSON.stringify({ license_key: 'FIG-0010', key_type: 'url' }),
    },

    // ── approved (24h 이내) ──────────────────────────────────
    {
      asset_sw_id: swAdobeCC.id, requester_id: u3.id,
      status: 'approved', request_type: 'register',
      request_date: new Date(Date.now() - 4 * 60 * 60 * 1000),
      required_quantity: 1,
      processed_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
      new_asset_data: JSON.stringify({ license_key: 'ADCC-0010', key_type: 'credential' }),
    },

    // ── rejected (24h 이내) ──────────────────────────────────
    {
      asset_sw_id: null, requester_id: u2.id,
      status: 'rejected', request_type: 'register',
      request_date: new Date(Date.now() - 7 * 60 * 60 * 1000),
      required_quantity: 1,
      admin_reason: '해당 SW는 회사 정책상 지원하지 않습니다.',
      processed_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
      new_asset_data: JSON.stringify({
        name: 'Notion', software_type: 'collaboration',
        manufacturer: 'Notion Labs', is_subscription: true,
        license_key: 'NOTION-0001', key_type: 'url',
      }),
    },

    // ── return 히스토리 (returnSw 컨트롤러 레코드 재현) ──────
    {
      asset_sw_id: swFigma.id, requester_id: u3.id,
      status: 'approved', request_type: 'return',
      request_date: new Date('2024-03-01'),
      required_quantity: 1, processed_at: new Date('2024-03-01'),
    },
  ]);
  console.log('📋 AssetSwRequest 생성');

  // ── 9. AssetProject (2개) ─────────────────────────────────────────────────
  const [projectA, projectB] = await AssetProject.bulkCreate([
    { name: 'A사 현장 구축 프로젝트',  description: '2024년 1분기 A사 IT 인프라 구축',         start_date: '2024-01-01', end_date: '2024-06-30'  },
    { name: 'B사 네트워크 고도화',      description: '2024년 B사 네트워크 장비 교체 및 고도화', start_date: '2024-03-01', end_date: '2024-12-31'  },
  ], { returning: true });
  console.log('📁 AssetProject 생성');

  // ── 10. AssetProjectItemType (3개) ────────────────────────────────────────
  const [dfTypeNb, dfTypeMon, dfTypeCable] = await AssetProjectItemType.bulkCreate([
    { name: '노트북' },
    { name: '모니터' },
    { name: '케이블' },
  ], { returning: true });

  // ── 11. AssetProjectItem (14개) ───────────────────────────────────────────
  const dfItems = await AssetProjectItem.bulkCreate([

    // ═══ Project A (7개: active 4 / stored 1 / rented 1 / returned 1) ═══
    {
      project_id: projectA.id, user_id: u1.id,     item_number: 1,
      asset_type_id: dfTypeNb.id, manufacturer: 'Dell', model_name: 'Latitude 5540',
      serial_number: 'SN-DF-DELL-001', spec: 'i5 / 16GB / 512GB',
      quantity: 2, quantity_unit: 'ea',
      rental_start_date: '2024-01-10', rental_end_date: '2024-06-30',
      state: 'active', location: 'A사 현장 1층',
    },
    {
      project_id: projectA.id, user_id: u1.id,     item_number: 2,
      asset_type_id: dfTypeMon.id, manufacturer: 'LG', model_name: '27UL600',
      serial_number: 'SN-DF-LG-MON-001', spec: '27인치 4K',
      quantity: 2, quantity_unit: 'ea',
      rental_start_date: '2024-01-10', rental_end_date: '2024-06-30',
      state: 'active', location: 'A사 현장 1층',
    },
    {
      project_id: projectA.id, user_id: u2.id,     item_number: 3,
      asset_type_id: dfTypeNb.id, manufacturer: 'Lenovo', model_name: 'ThinkPad E15',
      serial_number: 'SN-DF-LNV-001', spec: 'i5 / 8GB / 256GB',
      quantity: 1, quantity_unit: 'ea',
      rental_start_date: '2024-02-01', rental_end_date: '2024-06-30',
      state: 'active', location: 'A사 현장 2층',
    },
    {
      project_id: projectA.id, user_id: admin1.id, item_number: 4,
      asset_type_id: dfTypeCable.id, manufacturer: 'Belden', model_name: 'Cat.6 UTP',
      serial_number: null, spec: '20m',
      quantity: 10, quantity_unit: 'ea',
      rental_start_date: '2024-01-10',
      state: 'active', location: 'A사 현장 2층',
    },
    {
      project_id: projectA.id, user_id: admin1.id, item_number: 5,
      asset_type_id: dfTypeNb.id, manufacturer: 'HP', model_name: 'ProBook 450 G10',
      serial_number: 'SN-DF-HP-001', spec: 'i5 / 8GB / 256GB',
      quantity: 1, quantity_unit: 'ea', rental_start_date: '2024-01-10',
      state: 'stored', location: '창고 A',
    },
    {
      project_id: projectA.id, user_id: u3.id,     item_number: 6,
      asset_type_id: dfTypeMon.id, manufacturer: 'Samsung', model_name: 'S27R750',
      serial_number: 'SN-DF-SAM-MON-001', spec: '27인치 FHD 144Hz',
      quantity: 1, quantity_unit: 'ea',
      rental_start_date: '2024-02-01', rental_end_date: '2024-05-31',
      state: 'rented', location: 'A사 현장 3층',
    },
    {
      project_id: projectA.id, user_id: u1.id,     item_number: 7,
      asset_type_id: dfTypeCable.id, manufacturer: 'Belden', model_name: 'Cat.5e UTP',
      serial_number: null, spec: '10m',
      quantity: 5, quantity_unit: 'ea', rental_start_date: '2024-01-10',
      state: 'returned', location: null,
    },

    // ═══ Project B (7개: active 3 / stored 1 / rented 1 / returned 2) ═══
    {
      project_id: projectB.id, user_id: u2.id,     item_number: 1,
      asset_type_id: dfTypeNb.id, manufacturer: 'Lenovo', model_name: 'ThinkPad X1 Carbon',
      serial_number: 'SN-DF-LNV-002', spec: 'i7 / 16GB / 512GB',
      quantity: 3, quantity_unit: 'ea',
      rental_start_date: '2024-03-01', rental_end_date: '2024-12-31',
      state: 'active', location: 'B사 현장 1층',
    },
    {
      project_id: projectB.id, user_id: u3.id,     item_number: 2,
      asset_type_id: dfTypeMon.id, manufacturer: 'Dell', model_name: 'P2723D',
      serial_number: 'SN-DF-DELL-MON-001', spec: '27인치 QHD IPS',
      quantity: 3, quantity_unit: 'ea',
      rental_start_date: '2024-03-01', rental_end_date: '2024-12-31',
      state: 'active', location: 'B사 현장 1층',
    },
    {
      project_id: projectB.id, user_id: admin2.id, item_number: 3,
      asset_type_id: dfTypeCable.id, manufacturer: 'Belden', model_name: 'Cat.6A UTP',
      serial_number: null, spec: '30m',
      quantity: 20, quantity_unit: 'ea', rental_start_date: '2024-03-01',
      state: 'active', location: 'B사 현장 2층',
    },
    {
      project_id: projectB.id, user_id: admin2.id, item_number: 4,
      asset_type_id: dfTypeNb.id, manufacturer: 'Apple', model_name: 'MacBook Air M2',
      serial_number: 'SN-DF-APL-001', spec: 'M2 / 8GB / 256GB',
      quantity: 1, quantity_unit: 'ea', rental_start_date: '2024-03-01',
      state: 'stored', location: '창고 B',
    },
    {
      project_id: projectB.id, user_id: u1.id,     item_number: 5,
      asset_type_id: dfTypeMon.id, manufacturer: 'LG', model_name: '34WP85C',
      serial_number: 'SN-DF-LG-UW-001', spec: '34인치 울트라와이드 QHD',
      quantity: 1, quantity_unit: 'ea',
      rental_start_date: '2024-03-10', rental_end_date: '2024-09-30',
      state: 'rented', location: 'B사 현장 3층',
    },
    {
      project_id: projectB.id, user_id: u2.id,     item_number: 6,
      asset_type_id: dfTypeCable.id, manufacturer: 'Belden', model_name: 'Cat.5e UTP',
      serial_number: null, spec: '15m',
      quantity: 8, quantity_unit: 'ea', rental_start_date: '2024-03-01',
      state: 'returned', location: null,
    },
    {
      project_id: projectB.id, user_id: admin1.id, item_number: 7,
      asset_type_id: dfTypeNb.id, manufacturer: 'Samsung', model_name: 'Galaxy Book4',
      serial_number: 'SN-DF-SAM-NB-001', spec: 'i5 / 8GB / 256GB',
      quantity: 1, quantity_unit: 'ea', rental_start_date: '2024-03-01',
      state: 'returned', location: null,
    },
  ], { returning: true });
  console.log('📦 AssetProjectItem 생성:', dfItems.length, '개');

  // ── 12. AssetProjectHistory (10개) ────────────────────────────────────────
  await AssetProjectHistory.bulkCreate([
    // Project A
    { asset_project_item_id: dfItems[0].id,  project_id: projectA.id, change_by: u1.id,     change_type: 'register', location_before: null,           location_after: 'A사 현장 1층',  state: 'active'   },
    { asset_project_item_id: dfItems[1].id,  project_id: projectA.id, change_by: u1.id,     change_type: 'move',     location_before: 'A사 현장 창고', location_after: 'A사 현장 1층',  state: 'active'   },
    { asset_project_item_id: dfItems[2].id,  project_id: projectA.id, change_by: u2.id,     change_type: 'register', location_before: null,           location_after: 'A사 현장 2층',  state: 'active'   },
    { asset_project_item_id: dfItems[5].id,  project_id: projectA.id, change_by: u3.id,     change_type: 'move',     location_before: 'A사 현장 1층', location_after: 'A사 현장 3층',  state: 'rented'   },
    { asset_project_item_id: dfItems[6].id,  project_id: projectA.id, change_by: u1.id,     change_type: 'return',   location_before: 'A사 현장 1층', location_after: null,            state: 'returned' },
    // Project B
    { asset_project_item_id: dfItems[7].id,  project_id: projectB.id, change_by: u2.id,     change_type: 'register', location_before: null,           location_after: 'B사 현장 1층',  state: 'active'   },
    { asset_project_item_id: dfItems[8].id,  project_id: projectB.id, change_by: u3.id,     change_type: 'register', location_before: null,           location_after: 'B사 현장 1층',  state: 'active'   },
    { asset_project_item_id: dfItems[9].id,  project_id: projectB.id, change_by: admin2.id, change_type: 'move',     location_before: 'B사 현장 창고', location_after: 'B사 현장 2층',  state: 'active'   },
    { asset_project_item_id: dfItems[11].id, project_id: projectB.id, change_by: u2.id,     change_type: 'return',   location_before: 'B사 현장 2층', location_after: null,            state: 'returned' },
    { asset_project_item_id: dfItems[12].id, project_id: projectB.id, change_by: admin1.id, change_type: 'return',   location_before: 'B사 현장 1층', location_after: null,            state: 'returned' },
  ]);
  console.log('📜 AssetProjectHistory 생성');

  // ─── 완료 요약 ────────────────────────────────────────────────────────────
  console.log('\n✅ 시드 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 로그인 계정');
  console.log('   admin1 : ghkim@tbog.co.kr');
  console.log('   admin2 : shyang@tbog.co.kr');
  console.log('   user1  : iskra@tbog.co.kr      ← 테스트 주 계정');
  console.log('   user2  : younghuh@tbog.co.kr');
  console.log('   user3  : eypark@tbog.co.kr');
  console.log('');
  console.log('📊 데이터 요약');
  console.log('   Enterprise        : 16개 (active 8 / inactive 2 / stored 2 / returned 4)');
  console.log('   Enterprise Request: 10개 (pending 3 / approved 2 / rejected 1 / return 히스토리 4)');
  console.log('   SW License        : 14개 (active 11 / returned 3)');
  console.log('   SW Request        :  6개 (pending 3 / approved 1 / rejected 1 / return 히스토리 1)');
  console.log('   DF Item           : 14개 (active 7 / stored 2 / rented 2 / returned 3)');
  console.log('   DF History        : 10개 (register 4 / move 3 / return 3)');
  console.log('');
  console.log('🧪 주요 테스트 ID (실행 후 출력된 ID 기준)');
  console.log(`   Enterprise 반납·이동 (user1)   : asset_ids   [${ents[0].id}, ${ents[1].id}, ${ents[2].id}]`);
  console.log(`   Enterprise 반납·이동 (admin1)  : asset_ids   [${ents[5].id}, ${ents[6].id}]`);
  console.log(`   SW 이동 (location 있는 것)      : license_ids [${licenses[7].id}, ${licenses[8].id}]`);
  console.log(`   SW 반납 (user1)                : license_ids [${licenses[0].id}, ${licenses[4].id}]`);
  console.log(`   DF 이동·반납 (Project A)        : item_ids    [${dfItems[0].id}, ${dfItems[1].id}, ${dfItems[2].id}]`);
  console.log(`   DF 이동·반납 (Project B)        : item_ids    [${dfItems[7].id}, ${dfItems[8].id}]`);
  console.log(`   Enterprise 승인 대기 (admin)    : /assets/requests 조회 후 requestId 확인`);
  console.log(`   SW 승인 대기 (admin)             : /assets/requests 조회 후 requestId 확인`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await sequelize.close();
}

seed().catch((err) => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
