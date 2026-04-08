import os
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
    access_token: str = Field(min_length=8)
    media_limit: int = Field(default=24, ge=1, le=100)


class InstagramMediaRequest(BaseModel):
    access_token: str = Field(min_length=8)
    ig_user_id: str = Field(min_length=3)
    media_limit: int = Field(default=24, ge=1, le=100)


class InstagramBulkActionRequest(BaseModel):
    access_token: str = Field(min_length=8)
    action: Literal["delete", "archive"]
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

allowed_origins = parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", ""))
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


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
def instagram_session(body: InstagramSessionRequest) -> dict:
    try:
        return resolve_context_and_media(access_token=body.access_token.strip(), media_limit=body.media_limit)
    except GraphApiError as exc:
        raise HTTPException(status_code=max(400, min(exc.status_code, 502)), detail=str(exc)) from exc


@app.post("/api/instagram/media")
def instagram_media(body: InstagramMediaRequest) -> dict:
    try:
        return fetch_media_for_account(
            access_token=body.access_token.strip(),
            ig_user_id=body.ig_user_id.strip(),
            media_limit=body.media_limit,
        )
    except GraphApiError as exc:
        raise HTTPException(status_code=max(400, min(exc.status_code, 502)), detail=str(exc)) from exc


@app.post("/api/instagram/media/bulk-action")
def instagram_bulk_action(body: InstagramBulkActionRequest) -> dict:
    media_ids = [media_id.strip() for media_id in body.media_ids if media_id.strip()]
    if not media_ids:
        raise HTTPException(status_code=400, detail="Select at least one media item.")

    try:
        return run_bulk_media_action(
            access_token=body.access_token.strip(),
            action=body.action,
            media_ids=media_ids,
        )
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
        return job_manager.create_job(
            access_token=normalized_token,
            ig_user_id=normalized_ig_user,
            uploads=uploads,
            request_base_url=str(request.base_url).rstrip("/"),
        )
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
