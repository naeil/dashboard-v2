# Naeil Dashboard

PlayAuto 연동 데이터를 기반으로 매출, 상품 재고, 출고량, 수집 설정을 관리하는 대시보드 프로젝트입니다.  
백엔드는 Spring Boot, 프론트엔드는 Vite + React로 구성되어 있으며, PostgreSQL과 Redis를 함께 사용합니다.

## 주요 기능

- 매출 현황 조회
  - 일간 / 주간 / 월간 / 직접 선택 기간별 매출 요약
  - 매출 추이 분석, 마켓플레이스 비중, 브랜드별 실적 확인
- 상품 관리
  - 브랜드별 재고, 안전재고, 월 출고량 조회
  - 월 기준 집계 및 상품별 최신 수정일 확인
- 수집 설정
  - 주문 수집 기간 / 주문 수집 주기 설정
  - 주문 수집 수동 실행
  - 최근 수집 실행 이력 확인
- 인증 보호
  - 로그인 후 대시보드 접근 가능
  - 보호된 API에 대한 인증 체크

## 기술 스택

### Backend

- Java 21
- Spring Boot 3.2
- Spring Data JPA
- Flyway
- Redis Cache
- PostgreSQL

### Frontend

- React 19
- Vite 8
- Tailwind CSS
- Axios
- Chart.js

### Infra

- Docker
- Docker Compose

## 프로젝트 구조

```text
dashboard/
├─ src/
│  └─ main/
│     ├─ java/naeil/dashboard/
│     │  ├─ common/
│     │  ├─ controller/
│     │  ├─ dto/
│     │  ├─ entity/
│     │  ├─ repository/
│     │  └─ service/
│     └─ resources/
│        ├─ application.yml
│        └─ db/migration/
├─ frontend/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/
│  │  └─ pages/
│  ├─ package.json
│  └─ vite.config.js
├─ docker-compose.yml
├─ Dockerfile
├─ .env.example
└─ DEPLOY_VERCEL_RENDER.md
```

## 로컬 실행 방법

### 1. 인프라 실행

PostgreSQL과 Redis를 먼저 실행합니다.

```bash
docker compose up -d postgres redis
```

기본 포트:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

### 2. 백엔드 실행

로컬에서 직접 실행:

```bash
# Windows
.\gradlew.bat bootRun

# macOS / Linux
./gradlew bootRun
```

직접 실행 시 기본 주소:

- Backend: `http://localhost:8080`

또는 Docker로 실행:

```bash
docker compose up -d app
```

Docker 실행 시 기본 주소:

- Backend: `http://localhost:8081`

### 3. 프론트 실행

```bash
cd frontend
npm install
npm run dev
```

기본 주소:

- Frontend: `http://localhost:5173`

### 4. 로컬 프록시 설정

프론트 개발 서버에서 `/api` 요청을 백엔드로 프록시하려면 `frontend/.env.local` 파일을 사용합니다.

예시:

```env
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8081
```

백엔드를 `bootRun`으로 직접 실행했다면 `VITE_API_PROXY_TARGET=http://localhost:8080`으로 맞추면 됩니다.

## 환경변수

루트의 `.env.example`를 참고해서 환경변수를 준비할 수 있습니다.

주요 변수:

- `APP_CORS_ALLOWED_ORIGIN_PATTERNS`
- `APP_ENCRYPTION_SECRET_KEY`
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SPRING_DATA_REDIS_HOST`
- `SPRING_DATA_REDIS_PORT`
- `SPRING_DATA_REDIS_USERNAME`
- `SPRING_DATA_REDIS_PASSWORD`
- `SPRING_DATA_REDIS_SSL_ENABLED`

인증 관련 변수도 환경변수로 주입할 수 있습니다.

- `APP_AUTH_USERNAME`
- `APP_AUTH_PASSWORD`
- `APP_AUTH_TOKEN_SECRET`
- `APP_AUTH_TOKEN_TTL_SECONDS`

주의:

- 실제 비밀번호, 토큰 시크릿, 배포용 URL은 저장소에 커밋하지 않는 것을 권장합니다.
- 로컬 전용 값은 `.env`, `.env.local`, `frontend/.env.local` 등에 두고 Git에는 포함하지 않습니다.

## 주요 API 예시

### 인증

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### 매출

- `GET /api/sales/summary`
- `GET /api/sales/brand`
- `GET /api/sales/product`
- `GET /api/sales/trend`
- `GET /api/sales/brands`

### 상품 / 재고

- `GET /api/products/inventory`

### 설정 / 수집

- `GET /api/settings/integrations`
- `PUT /api/settings/integrations`
- `POST /api/settings/integrations/collection/run`
- `GET /api/settings/integrations/history`

## 빌드

### 백엔드

```bash
./gradlew.bat compileJava
./gradlew.bat bootJar
```

### 프론트

```bash
cd frontend
npm run build
```

## 배포

배포 가이드는 아래 문서를 참고하세요.

- [DEPLOY_VERCEL_RENDER.md](./DEPLOY_VERCEL_RENDER.md)

현재 추천 배포 조합:

- 프론트: Vercel 또는 Netlify
- 백엔드: Render
- 데이터베이스: Supabase Postgres
- Redis: Upstash Redis

## 참고

- DB 스키마 변경은 Flyway 마이그레이션으로 관리합니다.
- PlayAuto 연동 데이터는 주문 / 재고 / 출고량 기준으로 수집 및 집계합니다.
- 문서에는 로그인 값이나 실제 배포용 시크릿 값을 포함하지 않았습니다.
