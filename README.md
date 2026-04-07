# my-app

Minimal monorepo for a Vercel Next.js frontend and Railway FastAPI backend.

## Structure

```
my-app/
  apps/
    web/        # Next.js frontend
    api/        # FastAPI backend
  README.md
```

## Local development

### 1) Frontend (`apps/web`)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Runs on `http://localhost:3000`.

### 2) Backend (`apps/api`)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Runs on `http://localhost:8000`.

## Environment variables

### Frontend (`apps/web/.env.local`)

- `NEXT_PUBLIC_API_BASE_URL` (example: `http://localhost:8000`)

### Backend (`apps/api/.env`)

- `ALLOWED_ORIGINS` comma-separated origins allowed by CORS
  - example: `http://localhost:3000,https://your-frontend.vercel.app`

## Deployment notes

### Vercel (frontend)

- In your Vercel project, set **Root Directory** to `apps/web`
  - Dashboard path: `Project -> Settings -> Build and Deployment -> Root Directory`
- Keep framework preset as `Next.js`
- This repo also includes a root `vercel.json` that runs install/build/dev from `apps/web`

### Railway (backend)

- Railway service root should be `apps/api`
- Railway start command can use `Procfile`:
  - `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
