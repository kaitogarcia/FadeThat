import os
import threading
from typing import List, Literal

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .board_store import build_board_store
from .instagram_manager import (
    GraphApiError,
    build_job_manager,
    fetch_media_for_account,
    is_valid_asset_id,
    resolve_context_and_media,
    run_bulk_media_action,
)


def parse_allowed_origins(raw: str) -> List[str]:
    if not raw:
        return []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


class InstagramSessionRequest(BaseModel):
    access_token: str = Field(min_length=1)
    media_limit: int = Field(default=100, ge=1, le=100)


class InstagramMediaRequest(BaseModel):
    access_token: str = Field(min_length=1)
    ig_user_id: str = Field(min_length=3)
    media_limit: int = Field(default=100, ge=1, le=100)
    after_cursor: str | None = Field(default=None, min_length=1, max_length=512)


class InstagramBulkActionRequest(BaseModel):
    access_token: str = Field(min_length=1)
    action: Literal["delete", "archive"]
    ig_user_id: str | None = Field(default=None, min_length=3)
    media_ids: list[str] = Field(default_factory=list)


class BoardNote(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    text: str = Field(default="", max_length=12000)
    color: str = Field(min_length=3, max_length=32)
    width: int = Field(default=250, ge=180, le=1200)
    height: int = Field(default=250, ge=180, le=1200)


class BoardNotesRequest(BaseModel):
    notes: list[BoardNote] = Field(default_factory=list, max_length=500)


app = FastAPI(title="my-app api")
job_manager = build_job_manager()
board_store = build_board_store()
SPECIAL_LOGIN_TOKENS = {"hey", "baby"}
SPECIAL_TOKEN_ENV = "FADE_THAT_TOKEN"
BABY_ACTION_LIMIT = 5
_baby_action_usage: dict[str, int] = {}
_baby_action_lock = threading.Lock()

allowed_origins = parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", ""))
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def request_fingerprint(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    request_ip = forwarded or (request.client.host if request.client else "unknown")
    user_agent = (request.headers.get("user-agent") or "unknown")[:180]
    return f"{request_ip}|{user_agent}"


def resolve_access_token(raw_token: str) -> tuple[str, str]:
    normalized = raw_token.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Access token is required.")

    normalized_lower = normalized.lower()

    if normalized_lower not in SPECIAL_LOGIN_TOKENS:
        return normalized, "direct"

    configured_special_token = os.getenv(SPECIAL_TOKEN_ENV, "").strip()
    if not configured_special_token:
        raise HTTPException(
            status_code=500,
            detail=f"Special login requested but {SPECIAL_TOKEN_ENV} is not configured.",
        )

    return configured_special_token, normalized_lower


def get_baby_actions_remaining(request: Request) -> int:
    with _baby_action_lock:
        usage = _baby_action_usage.get(request_fingerprint(request), 0)
    return max(0, BABY_ACTION_LIMIT - usage)


def consume_baby_action(request: Request) -> int:
    fingerprint = request_fingerprint(request)
    with _baby_action_lock:
        usage = _baby_action_usage.get(fingerprint, 0)
        if usage >= BABY_ACTION_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"'baby' access is capped at {BABY_ACTION_LIMIT} actions.",
            )
        usage += 1
        _baby_action_usage[fingerprint] = usage
    return max(0, BABY_ACTION_LIMIT - usage)


def attach_access_meta(payload: dict, access_mode: str, request: Request) -> dict:
    enriched = dict(payload)
    enriched["access_mode"] = access_mode
    if access_mode == "baby":
        enriched["actions_remaining"] = get_baby_actions_remaining(request)
    return enriched


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/hello")
def hello(name: str = "world") -> dict:
    return {"message": f"Hello, {name}!"}


@app.get("/api/board/notes")
def get_board_notes() -> dict:
    return {"notes": board_store.list_notes()}


@app.put("/api/board/notes")
def put_board_notes(body: BoardNotesRequest) -> dict:
    normalized: list[dict] = []
    seen_ids: set[str] = set()

    for note in body.notes:
        if note.id in seen_ids:
            continue

        seen_ids.add(note.id)
        normalized.append(
            {
                "id": note.id,
                "text": note.text,
                "color": note.color,
                "width": note.width,
                "height": note.height,
            }
        )

    board_store.replace_notes(normalized)
    return {"notes": board_store.list_notes()}


@app.post("/api/instagram/session")
def instagram_session(body: InstagramSessionRequest, request: Request) -> dict:
    try:
        access_token, access_mode = resolve_access_token(body.access_token)
        payload = resolve_context_and_media(
            access_token=access_token,
            media_limit=body.media_limit,
        )
        return attach_access_meta(payload, access_mode, request)
    except GraphApiError as exc:
        raise HTTPException(status_code=max(400, min(exc.status_code, 502)), detail=str(exc)) from exc


@app.post("/api/instagram/media")
def instagram_media(body: InstagramMediaRequest, request: Request) -> dict:
    try:
        access_token, access_mode = resolve_access_token(body.access_token)
        payload = fetch_media_for_account(
            access_token=access_token,
            ig_user_id=body.ig_user_id.strip(),
            media_limit=body.media_limit,
            after_cursor=(body.after_cursor or "").strip() or None,
        )
        return attach_access_meta(payload, access_mode, request)
    except GraphApiError as exc:
        raise HTTPException(status_code=max(400, min(exc.status_code, 502)), detail=str(exc)) from exc


@app.post("/api/instagram/media/bulk-action")
def instagram_bulk_action(body: InstagramBulkActionRequest, request: Request) -> dict:
    media_ids = [media_id.strip() for media_id in body.media_ids if media_id.strip()]
    if not media_ids:
        raise HTTPException(status_code=400, detail="Select at least one media item.")

    try:
        access_token, access_mode = resolve_access_token(body.access_token)
        if access_mode == "baby":
            consume_baby_action(request)

        payload = run_bulk_media_action(
            access_token=access_token,
            action=body.action,
            media_ids=media_ids,
            ig_user_id=(body.ig_user_id or "").strip() or None,
        )
        return attach_access_meta(payload, access_mode, request)
    except GraphApiError as exc:
        raise HTTPException(status_code=max(400, min(exc.status_code, 502)), detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/instagram/post-jobs")
async def create_instagram_post_job(
    request: Request,
    access_token: str = Form(...),
    ig_user_id: str = Form(...),
    files: list[UploadFile] = File(...),
) -> dict:
    normalized_token = access_token.strip()
    normalized_ig_user = ig_user_id.strip()

    if not normalized_token:
        raise HTTPException(status_code=400, detail="Access token is required.")
    if not normalized_ig_user:
        raise HTTPException(status_code=400, detail="Instagram user id is required.")
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one photo.")
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Upload up to 50 photos per job.")

    uploads: list[tuple[str, bytes]] = []
    for upload in files:
        payload = await upload.read()
        if not payload:
            continue
        uploads.append((upload.filename or "upload.jpg", payload))

    if not uploads:
        raise HTTPException(status_code=400, detail="No readable image payloads were uploaded.")

    try:
        resolved_token, access_mode = resolve_access_token(normalized_token)
        if access_mode == "baby":
            consume_baby_action(request)

        payload = job_manager.create_job(
            access_token=resolved_token,
            ig_user_id=normalized_ig_user,
            uploads=uploads,
            request_base_url=str(request.base_url).rstrip("/"),
        )
        return attach_access_meta(payload, access_mode, request)
    except GraphApiError as exc:
        raise HTTPException(status_code=max(400, min(exc.status_code, 502)), detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/instagram/post-jobs/{job_id}")
def get_instagram_post_job(job_id: str) -> dict:
    snapshot = job_manager.get_job(job_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return snapshot


@app.get("/api/instagram/uploads/{asset_id}")
def get_instagram_upload(asset_id: str):
    if not is_valid_asset_id(asset_id):
        raise HTTPException(status_code=404, detail="Asset not found.")

    file_path = job_manager.uploads_dir / f"{asset_id}.jpg"
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found.")

    return FileResponse(file_path, media_type="image/jpeg")
