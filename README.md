## DB 초기화 방법

0. env 파일과 'npm i'로 의존성 패키지들을 다운받아 주세요.
- env 파일은 TAMS 노션에 작성 방법을 참고해 주세요!
- 1번을 실행하기 전, db를 초기화 해주세요 (db 초기화 방법은 TAMS 노션에 'DB 테이블 초기화 방법'을 참고해 주세요!)

### 1. /back 디렉토리 위치에서 다음과 같은 명령어를 입력합니다.

```cmd
npm run dev
```
- 초기화된 DB에 테이블 및 제약조건이 자동으로 생성됩니다.

### 2. (1)에서 Ctrl+c를 눌러 종료하고 seed 파일을 실행해 주세요.

```powershell
node seed.js
```
- seed.js 파일은 "/back" 위치에 넣어주세요!

### 3. (2)에서 시드가 잘 생성되었다면, 다시 한 번 백엔드 서버를 실행해 주세요

```cmd
npm run dev
```

### 4. 각 엑셀 import API를 통해 엑셀 파일을 넣고, 요청해 주세요.

```shell
// df
POST api/assets/df/import

// sw
POST /api/assets/sw/import/original

// enterprise
POST /api/assets/enterprise/import/original
```

### 5. (4)에서 성공적으로 데이터가 db에 저장되었다면, mariadb CLI 혹은 GUI에서 확인해 주세요!

```sql
// sw
SELECT * FROM asset_sw; // sw 조회
SELECT * FROM asset_sw_license; // sw 라이선스 조회

// enterprise
SELECT * FROM asset_enterprise; // PC 자산 조회
SELECT * FROM asset_enterprise_item_type; // PC 중분류 및 분류 코드 조회
SELECT * FROM asset_enterprise_category; // PC 대분류 조회

// df
SELECT * FROM asset_project; // df 프로젝트 조회
SELECT * FROM asset_project_item; // df 자산 조회
SELECT * FROM asset_project_item_type; // df 자산 대분류, 중분류 조회
```