# Deployment Guide: Vercel/Netlify + Render + Supabase + Upstash

This project is now set up for a split deployment:

- Frontend: `Vercel` or `Netlify`
- Backend API: `Render` web service from this repo's `Dockerfile`
- Database: `Supabase Postgres`
- Cache: `Upstash Redis`

## 1. What changed in the code

The repository now supports this deployment model directly:

- Frontend API calls use `VITE_API_BASE_URL`
  - If empty, the frontend keeps using local `/api` proxying in development.
  - If set, the frontend calls `https://your-render-service.onrender.com/api/...`
- Backend CORS uses `APP_CORS_ALLOWED_ORIGIN_PATTERNS`
  - Local dev still works by default.
  - Production frontend domains can be added without code changes.
- Backend Redis config now supports:
  - `SPRING_DATA_REDIS_USERNAME`
  - `SPRING_DATA_REDIS_PASSWORD`
  - `SPRING_DATA_REDIS_SSL_ENABLED`
- Backend port now supports Render's `PORT` environment variable automatically.

## 2. Recommended deployment order

Deploy in this order:

1. Create Supabase database
2. Create Upstash Redis database
3. Deploy backend to Render
4. Deploy frontend to Vercel or Netlify
5. Add the final frontend domain to backend CORS
6. Redeploy frontend if you change `VITE_API_BASE_URL`

## 3. Supabase setup

### Create the project

1. Log in to Supabase.
2. Create a new project.
3. Wait for the database to finish provisioning.

### Get the connection string

1. Open your project.
2. Click `Connect`.
3. Choose a Postgres connection string.

For this app, prefer:

- `Direct connection` if your Render region/network supports IPv6.
- `Session pooler` if you want broader compatibility with IPv4/IPv6.

Use a JDBC URL like:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://db.your-project.supabase.co:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=your-supabase-db-password
```

If you use Supabase's session pooler, convert it to JDBC format:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://aws-0-your-region.pooler.supabase.com:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres.your-project-ref
SPRING_DATASOURCE_PASSWORD=your-supabase-db-password
```

## 4. Upstash setup

### Create the Redis database

1. Log in to Upstash.
2. Create a Redis database.
3. Pick the region closest to your Render backend if possible.

### Copy connection info

From the database details page, copy:

- `Endpoint`
- `Port`
- `Password`

Upstash enables TLS by default, so use:

```env
SPRING_DATA_REDIS_HOST=your-database.upstash.io
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_USERNAME=default
SPRING_DATA_REDIS_PASSWORD=your-upstash-password
SPRING_DATA_REDIS_SSL_ENABLED=true
```

## 5. Render backend setup

### Create the service

1. Push this repo to GitHub.
2. In Render, click `New` -> `Web Service`.
3. Connect the repository.
4. Use these settings:

- Runtime: `Docker`
- Dockerfile path: `./Dockerfile`
- Branch: your production branch
- Region: choose one close to your users and to Upstash/Supabase

Render Docker web services expect the app to bind to `PORT`, and this project now supports that automatically.

### Add environment variables in Render

Set these in the Render dashboard:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://db.your-project.supabase.co:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=your-supabase-db-password

SPRING_DATA_REDIS_HOST=your-database.upstash.io
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_USERNAME=default
SPRING_DATA_REDIS_PASSWORD=your-upstash-password
SPRING_DATA_REDIS_SSL_ENABLED=true

APP_ENCRYPTION_SECRET_KEY=your-32-byte-secret
APP_CORS_ALLOWED_ORIGIN_PATTERNS=https://your-frontend.vercel.app
```

If you want preview deployments to work too, you can widen it:

```env
APP_CORS_ALLOWED_ORIGIN_PATTERNS=https://your-frontend.vercel.app,https://*.vercel.app
```

Or for Netlify:

```env
APP_CORS_ALLOWED_ORIGIN_PATTERNS=https://your-site.netlify.app,https://*.netlify.app
```

Use wildcard preview origins only if you are comfortable allowing those preview domains.

### First deploy checks

After the first Render deploy:

1. Open the Render service URL.
2. Test one API endpoint directly in the browser:

```text
https://your-render-service.onrender.com/api/sales/brands?companyId=1
```

If Flyway migration and DB connection both worked, you should get JSON back.

## 6. Vercel frontend setup

### Project creation

1. Import the same GitHub repository into Vercel.
2. Set `Root Directory` to `frontend`.
3. Vercel should detect `Vite`.

Use these build settings if needed:

- Build Command: `npm run build`
- Output Directory: `dist`

### Environment variable

Add:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
```

Apply it to:

- `Production`
- `Preview`
- `Development` if you want local `vercel dev` to hit Render too

Then redeploy.

## 7. Netlify frontend setup

### Site creation

1. Add a new site from your Git repository.
2. Set:

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`

Netlify usually auto-detects these values for Vite, but set them explicitly if needed.

### Environment variable

Add:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
```

After saving the variable, trigger a new deploy.

## 8. Local development after this change

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local` if you want to customize local behavior.

Common options:

```env
# Use local backend via proxy
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
```

```env
# Use Docker backend via proxy
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8081
```

```env
# Call deployed Render backend directly from local frontend
VITE_API_BASE_URL=https://your-render-service.onrender.com
```

### Backend

Copy `.env.example` values into your local environment or Docker Compose overrides as needed.

## 9. Common issues

### CORS error in browser

Check:

- `APP_CORS_ALLOWED_ORIGIN_PATTERNS` includes the exact frontend origin
- You redeployed Render after changing the variable
- `VITE_API_BASE_URL` points to the correct Render URL

### Frontend still calls local `/api`

Check:

- `VITE_API_BASE_URL` is set in Vercel or Netlify
- You triggered a fresh frontend deploy after changing it

### Render deploy succeeds but API fails at runtime

Check:

- Supabase URL, username, password
- Upstash host, password, TLS setting
- Render logs for Flyway or Redis connection errors

### Redis connection fails

Check:

- `SPRING_DATA_REDIS_SSL_ENABLED=true`
- `SPRING_DATA_REDIS_USERNAME=default`
- host and port exactly match the Upstash dashboard

## 10. Quick variable checklist

### Render

```env
SPRING_DATASOURCE_URL=
SPRING_DATASOURCE_USERNAME=
SPRING_DATASOURCE_PASSWORD=
SPRING_DATA_REDIS_HOST=
SPRING_DATA_REDIS_PORT=
SPRING_DATA_REDIS_USERNAME=
SPRING_DATA_REDIS_PASSWORD=
SPRING_DATA_REDIS_SSL_ENABLED=true
APP_ENCRYPTION_SECRET_KEY=
APP_CORS_ALLOWED_ORIGIN_PATTERNS=
```

### Vercel or Netlify

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
```
