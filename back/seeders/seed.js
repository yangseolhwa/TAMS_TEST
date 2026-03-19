const {
  AssetEnterpriseCategory,
  AssetEnterpriseItemType,
  AssetEnterprise,
  AssetSw,
  AssetSwLicense,
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
        user_id:           1,
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
        user_id:           1,
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
        user_id:           1,
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
};

module.exports = runSeed;