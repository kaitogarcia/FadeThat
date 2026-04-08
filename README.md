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
  - Railway example: `https://<your-railway-service>.up.railway.app`
- `API_BASE_URL` optional server-side proxy target for `/api/*` rewrites in Next.js
  - local example: `http://localhost:8000`
  - Railway example: `https://<your-railway-service>.up.railway.app`
  - recommended for Vercel so browser calls to `https://www.fadethat.life/api/...` forward to Railway

### Backend (`apps/api/.env`)

- `ALLOWED_ORIGINS` comma-separated origins allowed by CORS
  - example: `http://localhost:3000,https://your-frontend.vercel.app`
- `INSTAGRAM_PUBLIC_BASE_URL` public backend base URL used for uploaded image URLs in Instagram publish jobs
  - local example: `http://localhost:8000`
  - Railway example: `https://<your-railway-service>.up.railway.app`
- `INSTAGRAM_POST_BUFFER_SECONDS` delay between posts in mass post jobs (default `10`)
- `BOARD_DB_PATH` optional SQLite file path for board-note persistence
  - default: `apps/api/runtime/board.db`
  - Railway example with persistent disk: `/data/board.db`

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
- Set backend env vars:
  - `ALLOWED_ORIGINS=https://<your-vercel-domain>`
  - `INSTAGRAM_PUBLIC_BASE_URL=https://<your-railway-service>.up.railway.app`
  - `BOARD_DB_PATH=/data/board.db` (if using Railway volume mount)
