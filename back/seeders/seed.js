const {
  AssetEnterpriseCategory,
  AssetEnterpriseItemType,
  AssetEnterprise,
  AssetSw,
  AssetSwLicense,
  AssetProject,
  AssetProjectItem,
  AssetProjectItemType,
  User,
} = require('../models');

const runSeed = async () => {
  // AssetEnterpriseCategory
  const categoryCount = await AssetEnterpriseCategory.count();
  if (categoryCount === 0) {
  await AssetEnterpriseCategory.bulkCreate([
    { id: 1, name: '사무', created_at: new Date(), updated_at: new Date() },
    { id: 2, name: '가구', created_at: new Date(), updated_at: new Date() },
    { id: 3, name: '전기', created_at: new Date(), updated_at: new Date() },
    { id: 4, name: '전통', created_at: new Date(), updated_at: new Date() },
  ]);
  console.log('✅ AssetEnterpriseCategory 시드 완료');
}

  // ── 2. AssetEnterpriseItemType 시드 ──
  const itemTypeCount = await AssetEnterpriseItemType.count();
  if (itemTypeCount === 0) {
  await AssetEnterpriseItemType.bulkCreate([
    // 사무 (category_id: 1)
    { id: 1, category_id: 1, name: '노트북',  created_at: new Date(), updated_at: new Date() },
    { id: 2, category_id: 1, name: '데스크탑', created_at: new Date(), updated_at: new Date() },
    { id: 3, category_id: 1, name: '모니터',  created_at: new Date(), updated_at: new Date() },
    { id: 4, category_id: 1, name: '키보드',  created_at: new Date(), updated_at: new Date() },
    { id: 5, category_id: 1, name: '마우스',  created_at: new Date(), updated_at: new Date() },
    // 가구 (category_id: 2)
    { id: 6, category_id: 2, name: '의자',    created_at: new Date(), updated_at: new Date() },
    { id: 7, category_id: 2, name: '책상',    created_at: new Date(), updated_at: new Date() },
    // 전기 (category_id: 3)
    { id: 8, category_id: 3, name: '형광등',  created_at: new Date(), updated_at: new Date() },
    { id: 9, category_id: 3, name: '콘센트',  created_at: new Date(), updated_at: new Date() },
  ]);
  console.log('✅ AssetEnterpriseItemType 시드 완료');
}

  // ── 3. AssetEnterprise 시드 (user_id: 1 기준) ──
  const user = await User.findByPk(1);
  if (!user) {
    console.warn('⚠️  user_id: 1이 없어 AssetEnterprise 시드를 건너뜁니다.');
    return;
  }

  const enterpriseCount = await AssetEnterprise.count();
  if (enterpriseCount === 0) {
    await AssetEnterprise.bulkCreate([
      {
        asset_number:      'ENT-2024-001',
        category_id:       1,
        item_type_id:      2,
        department_id:     null,
        responsible_type:  'personal',
        user_id:           1,
        responsible_value: 'John Doe',
        state:             'active',
        acquisition_date:  '2024-01-15',
        return_date:       null,
        manufacturer:      'Samsung',
        spec:              'i7-1260P / 16GB / 512GB SSD',
        serial_number:     'SN-SAM-20240115-001',
        location:          '서울 본사 3층',
        remarks:           '개발팀 지급 노트북',
        created_at:        new Date(),
        updated_at:        new Date(),
      },
      {
        asset_number:      'ENT-2024-002',
        category_id:       2,
        item_type_id:      3,
        department_id:     null,
        responsible_type:  'personal',
        user_id:           1,
        responsible_value: 'John Doe',
        state:             'active',
        acquisition_date:  '2024-02-01',
        return_date:       null,
        manufacturer:      'LG',
        spec:              '27인치 4K IPS',
        serial_number:     'SN-LG-20240201-001',
        location:          '서울 본사 3층',
        remarks:           null,
        created_at:        new Date(),
        updated_at:        new Date(),
      },
      {
        asset_number:      'ENT-2024-003',
        category_id:       1,
        item_type_id:      1,
        department_id:     null,
        responsible_type:  'personal',
        user_id:           10,
        responsible_value: 'John Doe',
        state:             'stored',
        acquisition_date:  '2023-06-10',
        return_date:       null,
        manufacturer:      'Dell',  
        spec:              'i9-13900K / 32GB / 1TB SSD',
        serial_number:     'SN-DELL-20230610-001',
        location:          'IT 수리실',
        remarks:           '화면 불량으로 수리 중',
        created_at:        new Date(),
        updated_at:        new Date(),
      },
    ]);
    console.log('✅ AssetEnterprise 시드 완료');
  }

  // ── 4. AssetSw 시드 ──
  const swCount = await AssetSw.count();
  if (swCount === 0) {
    await AssetSw.bulkCreate([
      {
        id:              1,
        name:            'Windows 11 Pro',
        software_type:   'dev',
        manufacturer:    'Microsoft',
        is_subscription: false,
        state:           'active',
        created_at:      new Date(),
        updated_at:      new Date(),
      },
      {
        id:              2,
        name:            'Adobe Photoshop',
        software_type:   'design',
        manufacturer:    'Adobe',
        is_subscription: true,
        state:           'active',
        created_at:      new Date(),
        updated_at:      new Date(),
      },
      {
        id:              3,
        name:            'Microsoft Office 365',
        software_type:   'other',
        manufacturer:    'Microsoft',
        is_subscription: true,
        state:           'active',
        created_at:      new Date(),
        updated_at:      new Date(),
      },
    ]);
    console.log('✅ AssetSw 시드 완료');
  }

  // ── 5. AssetSwLicense 시드 ──
  const swLicenseCount = await AssetSwLicense.count();
  if (swLicenseCount === 0) {
    await AssetSwLicense.bulkCreate([
      {
        asset_sw_id:       1,
        user_id:           1,
        subscription_date: '2024-01-15',
        license_key:       'WIN11-XXXX-XXXX-XXXX-0001',
        license_password:  null,
        key_type:          'serial',
        related_link:      'https://microsoft.com',
        created_at:        new Date(),
        updated_at:        new Date(), 
      },
      {
        asset_sw_id:       2,
        user_id:           2,
        subscription_date: '2024-03-01',
        license_key:       'ADPS-XXXX-XXXX-XXXX-0001',
        license_password:  'adobe1234!',
        key_type:          'credential',
        related_link:      'https://adobe.com',
        created_at:        new Date(),
        updated_at:        new Date(),
      },
      {
        asset_sw_id:       3,
        user_id:           10,
        subscription_date: '2024-01-01',
        license_key:       'O365-XXXX-XXXX-XXXX-0001',
        license_password:  null,
        key_type:          'serial',
        related_link:      'https://microsoft.com/office',
        created_at:        new Date(),
        updated_at:        new Date(),
      },
    ]);
    console.log('✅ AssetSwLicense 시드 완료');
  }

  //── 6. AssetProjectItemType 시드 (DF 자산 종류) ──
  const projectItemTypeCount = await AssetProjectItemType.count();
if (projectItemTypeCount === 0) {
  await AssetProjectItemType.bulkCreate([
    { id: 1, name: '노트북',     is_cable: false },
    { id: 2, name: '모니터',     is_cable: false },
    { id: 3, name: '데스크탑',   is_cable: false },
    { id: 4, name: '공유기',     is_cable: false },
    { id: 5, name: '태블릿',     is_cable: false },
    { id: 6, name: 'HDMI 케이블', is_cable: true  },
    { id: 7, name: 'LAN 케이블',  is_cable: true  },
    { id: 8, name: '전원 케이블', is_cable: true  },
  ]);
  console.log('✅ AssetProjectItemType 시드 완료');
}

// ── 7. AssetProject 시드 ──
const projectCount = await AssetProject.count();
if (projectCount === 0) {
  await AssetProject.bulkCreate([
    {
      id:          1,
      name:        'A 프로젝트',
      description: '2024년 상반기 A사 SI 프로젝트',
      start_date:  '2024-01-01',
      end_date:    '2024-06-30',
      created_at:  new Date(),
      updated_at:  new Date(),
    },
    {
      id:          2,
      name:        'B 프로젝트',
      description: '2024년 하반기 B사 유지보수 프로젝트',
      start_date:  '2024-07-01',
      end_date:    '2024-12-31',
      created_at:  new Date(),
      updated_at:  new Date(),
    },
        {
      id:          3,
      name:        'C 프로젝트',
      description: '2026년 상반기 C사 보안 프로젝트',
      start_date:  '2024-07-01',
      end_date:    '2024-12-31',
      created_at:  new Date(),
      updated_at:  new Date(),
    },
        {
      id:          4,
      name:        'D 프로젝트',
      description: '2025년 하반기 D사 유지보수 프로젝트',
      start_date:  '2024-07-01',
      end_date:    '2024-12-31',
      created_at:  new Date(),
      updated_at:  new Date(),
    },
        {
      id:          5,
      name:        'E-XXX PC 프로젝트',
      description: '2025년 상반기 E사 XXX PC 유지보수 프로젝트',
      start_date:  '2024-07-01',
      end_date:    '2024-12-31',
      created_at:  new Date(),
      updated_at:  new Date(),
    },
  ]);
  console.log('✅ AssetProject 시드 완료');
}

// ── 8. AssetProjectItem 시드 ──
const projectItemCount = await AssetProjectItem.count();
if (projectItemCount === 0) {
  await AssetProjectItem.bulkCreate([
    // A 프로젝트 자산
    {
      user_id:            1,
      project_id:         1,
      item_number:        1,
      asset_type_id:      1,             // 노트북
      doosan_item_number: 'DI-2024-001',
      manufacturer:       'Samsung',
      model_name:         'Galaxy Book4 Pro',
      serial_number:      'SN-GB4-001',
      spec:               null,
      quantity:           3,
      quantity_unit:      'ea',
      rental_start_date:  '2024-01-01',
      rental_end_date:    '2024-06-30',
      state:              'active',
      location:           'A사 현장 2층',
      remarks:            'A 프로젝트 개발팀 지급',
      created_at:         new Date(),
      updated_at:         new Date(),
    },
    {
      user_id:            10,
      project_id:         1,
      item_number:        2,
      asset_type_id:      2,             // 모니터
      doosan_item_number: 'DI-2024-002',
      manufacturer:       'LG',
      model_name:         '27UL500',
      serial_number:      'SN-LG-002',
      spec:               null,
      quantity:           3,
      quantity_unit:      'ea',
      rental_start_date:  '2024-01-01',
      rental_end_date:    '2024-06-30',
      state:              'active',
      location:           'A사 현장 2층',
      remarks:            null,
      created_at:         new Date(),
      updated_at:         new Date(),
    },
    {
      user_id:            2,
      project_id:         1,
      item_number:        3,
      asset_type_id:      6,             // HDMI 케이블
      doosan_item_number: 'DI-2024-003',
      manufacturer:       'Belkin',
      model_name:         'HDMI 2.1',
      serial_number:      'SN-LG-003',
      spec:               '2m',
      quantity:           5,
      quantity_unit:      'ea',
      rental_start_date:  '2024-01-01',
      rental_end_date:    '2024-06-30',
      state:              'active',
      location:           'A사 현장 2층',
      remarks:            null,
      created_at:         new Date(),
      updated_at:         new Date(),
    },
    // B 프로젝트 자산
    {
      user_id:            2,
      project_id:         2,
      item_number:        1,
      asset_type_id:      3,             // 데스크탑
      doosan_item_number: 'DI-2024-101',
      manufacturer:       'Dell',
      model_name:         'OptiPlex 7090',
      serial_number:      'SN-DELL-101',
      spec:               null,
      quantity:           2,
      quantity_unit:      'ea',
      rental_start_date:  '2024-07-01',
      rental_end_date:    '2024-12-31',
      state:              'active',
      location:           'B사 현장 3층',
      remarks:            '서버 운영용',
      created_at:         new Date(),
      updated_at:         new Date(),
    },
    {
      user_id:            2,
      project_id:         2,
      item_number:        2,
      asset_type_id:      4,             // 공유기
      doosan_item_number: 'DI-2024-102',
      manufacturer:       'ipTIME',
      model_name:         'AX8004BCM',
      serial_number:      'SN-IPT-102',
      spec:               null,
      quantity:           1,
      quantity_unit:      'ea',
      rental_start_date:  '2024-07-01',
      rental_end_date:    '2024-12-31',
      state:              'active',
      location:           'B사 현장 3층',
      remarks:            null,
      created_at:         new Date(),
      updated_at:         new Date(),
    },
    {
      user_id:            2,
      project_id:         2,
      item_number:        3,
      asset_type_id:      7,             // LAN 케이블
      doosan_item_number: 'DI-2024-103',
      manufacturer:       'UTP',
      model_name:         'CAT.6',
      serial_number:      'SN-LG-005',
      spec:               '10m',
      quantity:           10,
      quantity_unit:      'ea',
      rental_start_date:  '2024-07-01',
      rental_end_date:    '2024-12-31',
      state:              'stored',
      location:           'B사 현장 창고',
      remarks:            '예비 케이블',
      created_at:         new Date(),
      updated_at:         new Date(),
    },
  ]);
  console.log('✅ AssetProjectItem 시드 완료');
}




};

module.exports = runSeed;