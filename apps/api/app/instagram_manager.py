from __future__ import annotations

import io
import logging
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter, ImageOps, ImageStat

GRAPH_BASE = "https://graph.facebook.com/v24.0"
SCENE_LABELS = [
    "beach",
    "city",
    "nature",
    "portrait",
    "food",
    "night",
    "architecture",
    "pets",
    "travel",
    "sports",
]
OBJECT_LABELS = [
    "person",
    "dog",
    "cat",
    "car",
    "tree",
    "building",
    "food",
    "phone",
    "laptop",
    "bicycle",
]
ASCII_FRAMES = ["[|....]", "[/....]", "[-....]", "[\\....]"]
logger = logging.getLogger(__name__)


class GraphApiError(RuntimeError):
    def __init__(self, message: str, status_code: int, payload: object | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass
class VisionResult:
    clip_label: str
    confidence_percent: int
    objects: list[str]
    brightness: int
    sharpness: int
    color_profile: str
    composition: str
    people_signals: str
    safety: str
    text_in_image: str


class VisionCaptionGenerator:
    """Caption generator adapted from INSTAGRAM_POST_AGENT/app/vision.py.

    The natural-language section is intentionally removed. Output is concise,
    signal-oriented caption metadata for Instagram posts.
    """

    def __init__(self, *, max_side: int = 640) -> None:
        self.max_side = max(256, int(max_side))
        self._clip_bundle = None
        self._model_failures: set[str] = set()

    def analyze_image(self, path: Path) -> VisionResult:
        image = Image.open(path).convert("RGB")
        image = self._resize_for_inference(image)
        brightness = self._brightness_score(image)
        sharpness = self._sharpness_score(image)
        clip_label, confidence = self._clip_scene(image)
        objects = self._clip_object_hints(image)
        color_profile = self._color_profile(image)
        composition = self._composition_profile(image)
        people_signals = self._people_signals(objects, image.size)
        safety = self._safety_profile(clip_label, objects)
        text_in_image = self._text_signal(image)
        return VisionResult(
            clip_label=clip_label,
            confidence_percent=confidence,
            objects=objects,
            brightness=brightness,
            sharpness=sharpness,
            color_profile=color_profile,
            composition=composition,
            people_signals=people_signals,
            safety=safety,
            text_in_image=text_in_image,
        )

    def build_caption(self, result: VisionResult) -> str:
        object_text = ", ".join(result.objects) if result.objects else "none"
        lines = [
            f"scene:{result.clip_label}",
            f"confidence:{result.confidence_percent}%",
            f"objects:{object_text}",
            f"brightness:{result.brightness}",
            f"sharpness:{result.sharpness}",
            f"color:{result.color_profile}",
            f"composition:{result.composition}",
            f"people:{result.people_signals}",
            f"safety:{result.safety}",
            f"text_signal:{result.text_in_image}",
        ]
        return "\n".join(lines)

    def _resize_for_inference(self, image: Image.Image) -> Image.Image:
        width, height = image.size
        longest = max(width, height)
        if longest <= self.max_side:
            return image
        scale = self.max_side / float(longest)
        target = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
        return image.resize(target, Image.Resampling.BILINEAR)

    def _brightness_score(self, image: Image.Image) -> int:
        grayscale = image.convert("L")
        mean = ImageStat.Stat(grayscale).mean[0]
        return max(0, min(100, round(mean / 255 * 100)))

    def _sharpness_score(self, image: Image.Image) -> int:
        grayscale = image.convert("L")
        edges = grayscale.filter(ImageFilter.FIND_EDGES)
        variance = float(np.var(np.asarray(edges)))
        return max(0, min(100, round(min(variance / 1500, 1.0) * 100)))

    def _color_profile(self, image: Image.Image) -> str:
        arr = np.asarray(image, dtype=np.float32)
        avg_rgb = arr.mean(axis=(0, 1))
        warmth = (avg_rgb[0] - avg_rgb[2]) / 255.0
        hsv = np.asarray(image.convert("HSV"), dtype=np.float32)
        saturation = float(hsv[:, :, 1].mean() / 255.0)
        sample = arr.reshape(-1, 3)
        stride = max(1, len(sample) // 2000)
        sample = sample[::stride]
        if len(sample) == 0:
            return "balanced tones; low color variance"

        bins = (sample // 32).astype(int)
        keys, counts = np.unique(bins, axis=0, return_counts=True)
        order = np.argsort(counts)[::-1][:3]
        palette: list[str] = []
        for idx in order:
            c = keys[idx] * 32 + 16
            palette.append(f"#{int(c[0]):02X}{int(c[1]):02X}{int(c[2]):02X}")

        temp = "warm-leaning" if warmth > 0.05 else ("cool-leaning" if warmth < -0.05 else "neutral")
        sat = "high saturation" if saturation > 0.45 else ("muted saturation" if saturation < 0.22 else "moderate saturation")
        return f"{temp}, {sat}, dominant palette {', '.join(palette)}"

    def _composition_profile(self, image: Image.Image) -> str:
        gray = np.asarray(image.convert("L"), dtype=np.float32)
        h, w = gray.shape
        center_x, center_y = w / 2.0, h / 2.0
        grad_x = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
        grad_y = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
        weights = grad_x + grad_y + 1e-6
        xs = np.tile(np.arange(w), (h, 1))
        ys = np.tile(np.arange(h).reshape(-1, 1), (1, w))
        mass = float(weights.sum())
        focal_x = float((weights * xs).sum() / mass)
        focal_y = float((weights * ys).sum() / mass)
        offset_x = (focal_x - center_x) / max(center_x, 1)
        offset_y = (focal_y - center_y) / max(center_y, 1)

        left = gray[:, : w // 2]
        right = np.fliplr(gray[:, w - left.shape[1] :])
        symmetry = 100 - int(min(100, np.mean(np.abs(left - right)) / 255.0 * 200))

        horiz = "centered" if abs(offset_x) < 0.08 else ("left-weighted" if offset_x < 0 else "right-weighted")
        vert = "mid-frame" if abs(offset_y) < 0.08 else ("upper-frame" if offset_y < 0 else "lower-frame")
        return f"{horiz}, {vert}, symmetry score {symmetry}/100"

    def _people_signals(self, objects: list[str], size: tuple[int, int]) -> str:
        people_count = 0
        for item in objects:
            if item.startswith("person x"):
                try:
                    people_count = int(item.split("x", 1)[1])
                except Exception:
                    people_count = 1
        width, height = size
        framing = "close/mid framing" if min(width, height) < 720 else "wide framing"
        if people_count == 0:
            return f"no clear person detections, {framing}"
        if people_count == 1:
            return f"single-person presence, likely primary subject, {framing}"
        return f"{people_count} people detected, possible group shot, {framing}"

    def _safety_profile(self, scene: str, objects: list[str]) -> str:
        object_names = {item.split(" x", 1)[0] for item in objects}
        risk = "low"
        notes: list[str] = ["no explicit high-risk visual cues in lightweight heuristic"]
        if scene == "night":
            notes.append("low-light conditions")
        if "car" in object_names or "bicycle" in object_names:
            notes.append("vehicle context present")
        if "person" in object_names and scene == "sports":
            notes.append("active human movement context")
        if len(notes) > 2:
            risk = "low-to-moderate"
        return f"{risk} risk; " + ", ".join(notes)

    def _text_signal(self, image: Image.Image) -> str:
        gray = np.asarray(image.convert("L"), dtype=np.uint8)
        binary = gray < max(80, int(gray.mean() * 0.7))
        h, w = binary.shape
        grid_h = 12
        grid_w = 12
        cell_h = max(1, h // grid_h)
        cell_w = max(1, w // grid_w)
        active = 0
        for gy in range(grid_h):
            for gx in range(grid_w):
                y0 = gy * cell_h
                x0 = gx * cell_w
                block = binary[y0 : min(h, y0 + cell_h), x0 : min(w, x0 + cell_w)]
                density = float(block.mean()) if block.size else 0.0
                if 0.10 < density < 0.45:
                    active += 1
        score = int(round(active / float(grid_h * grid_w) * 100))
        if score >= 28:
            return f"possible overlaid/embedded text regions detected (heuristic confidence {score}%)"
        return f"no strong text-like regions detected (heuristic confidence {100 - score}%)"

    def _clip_scene(self, image: Image.Image) -> tuple[str, int]:
        try:
            bundle = self._get_clip_bundle()
        except Exception:
            return ("general", 50)
        if bundle is None:
            return ("general", 50)

        processor, model = bundle
        import torch

        prompts = [f"a photo of {label}" for label in SCENE_LABELS]
        inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
        with torch.inference_mode():
            outputs = model(**inputs)
        logits = outputs.logits_per_image[0]
        probs = torch.softmax(logits, dim=0)
        index = int(torch.argmax(probs).item())
        confidence = int(round(float(probs[index].item()) * 100))
        return SCENE_LABELS[index], confidence

    def _clip_object_hints(self, image: Image.Image) -> list[str]:
        try:
            bundle = self._get_clip_bundle()
        except Exception:
            return []
        if bundle is None:
            return []
        processor, model = bundle
        import torch

        prompts = [f"a photo containing {label}" for label in OBJECT_LABELS]
        inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
        with torch.inference_mode():
            outputs = model(**inputs)
        logits = outputs.logits_per_image[0]
        probs = torch.softmax(logits, dim=0)
        top_indices = torch.topk(probs, k=min(3, len(OBJECT_LABELS))).indices.tolist()

        out: list[str] = []
        for idx in top_indices:
            confidence = int(round(float(probs[idx].item()) * 100))
            if confidence < 12:
                continue
            out.append(f"{OBJECT_LABELS[idx]} x1")
        return out

    def _get_clip_bundle(self):
        if "clip" in self._model_failures:
            return None
        if self._clip_bundle is not None:
            return self._clip_bundle
        try:
            from transformers import CLIPModel, CLIPProcessor

            processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self._clip_bundle = (processor, model)
        except Exception:
            self._model_failures.add("clip")
            return None
        return self._clip_bundle


class InstagramGraphClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._session = requests.Session()

    def _raise_for_status(self, response: requests.Response) -> None:
        if response.ok:
            return
        try:
            payload = response.json()
            error_payload = payload.get("error") if isinstance(payload, dict) else None
            if isinstance(error_payload, dict):
                message = error_payload.get("message") or str(payload)
            else:
                message = str(payload)
        except Exception:
            payload = response.text
            message = response.text

        raise GraphApiError(
            f"Graph API HTTP {response.status_code}: {message}",
            status_code=response.status_code,
            payload=payload,
        )

    def get(self, path: str, params: dict[str, str] | None = None) -> dict:
        payload = dict(params or {})
        payload["access_token"] = self.access_token
        response = self._session.get(f"{GRAPH_BASE}/{path.lstrip('/')}" , params=payload, timeout=60)
        self._raise_for_status(response)
        return response.json()

    def post(self, path: str, data: dict[str, str] | None = None) -> dict:
        payload = dict(data or {})
        payload["access_token"] = self.access_token
        response = self._session.post(f"{GRAPH_BASE}/{path.lstrip('/')}" , data=payload, timeout=60)
        self._raise_for_status(response)
        return response.json()

    def delete(self, path: str, params: dict[str, str] | None = None) -> dict:
        payload = dict(params or {})
        payload["access_token"] = self.access_token
        response = self._session.delete(f"{GRAPH_BASE}/{path.lstrip('/')}" , params=payload, timeout=60)
        self._raise_for_status(response)
        return response.json()

    def resolve_instagram_account(self) -> dict:
        pages_response = self.get(
            "me/accounts",
            {
                "fields": "id,name,access_token,instagram_business_account{id}",
                "limit": "100",
            },
        )
        pages = pages_response.get("data") or []
        for page in pages:
            instagram_business_account = page.get("instagram_business_account") or {}
            ig_user_id = str(instagram_business_account.get("id") or "").strip()
            if not ig_user_id:
                continue
            profile = self.get_ig_profile(ig_user_id)
            return {
                "page_id": str(page.get("id") or ""),
                "page_name": page.get("name") or "",
                "ig_user_id": ig_user_id,
                "profile": profile,
            }

        me_response = self.get("me", {"fields": "instagram_business_account{id}"})
        ig_user_id = str((me_response.get("instagram_business_account") or {}).get("id") or "").strip()
        if ig_user_id:
            profile = self.get_ig_profile(ig_user_id)
            return {
                "page_id": "",
                "page_name": "",
                "ig_user_id": ig_user_id,
                "profile": profile,
            }

        raise GraphApiError(
            "No Instagram business account was found for this token.",
            status_code=400,
        )

    def resolve_page_access_token_for_ig_user(self, ig_user_id: str) -> str | None:
        normalized_ig_user_id = str(ig_user_id or "").strip()
        if not normalized_ig_user_id:
            return None

        pages_response = self.get(
            "me/accounts",
            {
                "fields": "id,name,access_token,instagram_business_account{id}",
                "limit": "100",
            },
        )
        pages = pages_response.get("data") or []
        for page in pages:
            instagram_business_account = page.get("instagram_business_account") or {}
            page_ig_user_id = str(instagram_business_account.get("id") or "").strip()
            if page_ig_user_id != normalized_ig_user_id:
                continue
            page_access_token = str(page.get("access_token") or "").strip()
            if page_access_token:
                return page_access_token
        return None

    def get_ig_profile(self, ig_user_id: str) -> dict:
        profile = self.get(
            ig_user_id,
            {
                "fields": "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website",
            },
        )
        return {
            "id": str(profile.get("id") or ig_user_id),
            "username": profile.get("username") or "",
            "name": profile.get("name") or "",
            "profile_picture_url": profile.get("profile_picture_url") or "",
            "followers_count": int(profile.get("followers_count") or 0),
            "follows_count": int(profile.get("follows_count") or 0),
            "media_count": int(profile.get("media_count") or 0),
            "biography": profile.get("biography") or "",
            "website": profile.get("website") or "",
        }

    def list_media_page(
        self,
        ig_user_id: str,
        limit: int = 50,
        after_cursor: str | None = None,
    ) -> dict:
        params = {
            "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count",
            "limit": str(max(1, min(limit, 50))),
        }
        if after_cursor:
            params["after"] = after_cursor

        response = self.get(
            f"{ig_user_id}/media",
            params,
        )
        data = response.get("data") or []
        normalized: list[dict] = []
        for entry in data:
            normalized.append(
                {
                    "id": str(entry.get("id") or ""),
                    "caption": entry.get("caption") or "",
                    "media_type": entry.get("media_type") or "",
                    "media_url": entry.get("media_url") or "",
                    "thumbnail_url": entry.get("thumbnail_url") or "",
                    "permalink": entry.get("permalink") or "",
                    "timestamp": entry.get("timestamp") or "",
                    "like_count": int(entry.get("like_count") or 0),
                }
            )
        paging = response.get("paging") or {}
        cursors = paging.get("cursors") or {}
        next_cursor = str(cursors.get("after") or "").strip() or None
        return {
            "media": normalized,
            "next_cursor": next_cursor,
        }

    def list_media(self, ig_user_id: str, limit: int = 50) -> list[dict]:
        payload = self.list_media_page(ig_user_id=ig_user_id, limit=limit)
        return payload["media"]

    def create_image_container(self, ig_user_id: str, image_url: str, caption: str) -> str:
        response = self.post(
            f"{ig_user_id}/media",
            {
                "image_url": image_url,
                "caption": caption,
            },
        )
        container_id = str(response.get("id") or "").strip()
        if not container_id:
            raise GraphApiError("Graph API did not return a media container ID.", status_code=500, payload=response)
        return container_id

    def wait_ready(self, container_id: str, timeout_seconds: int = 180) -> None:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                response = self.get(container_id, {"fields": "status_code"})
            except GraphApiError:
                # transient polling failures can happen while container is becoming ready
                time.sleep(3)
                continue

            status = str(response.get("status_code") or "").upper()
            if status in ("", "FINISHED", "READY"):
                return
            if status in ("ERROR", "EXPIRED"):
                raise GraphApiError(f"Container {container_id} status is {status}.", status_code=400, payload=response)
            time.sleep(3)

        raise GraphApiError(f"Timed out waiting for container {container_id}.", status_code=504)

    def publish_container(self, ig_user_id: str, container_id: str) -> str:
        response = self.post(f"{ig_user_id}/media_publish", {"creation_id": container_id})
        publish_id = str(response.get("id") or "").strip()
        if not publish_id:
            raise GraphApiError("Graph API did not return a publish ID.", status_code=500, payload=response)
        return publish_id

    def get_permalink(self, media_id: str) -> str | None:
        try:
            response = self.get(media_id, {"fields": "permalink"})
            permalink = response.get("permalink")
            if permalink:
                return str(permalink)
            return None
        except GraphApiError:
            return None

    def publish_photo(self, ig_user_id: str, image_url: str, caption: str) -> dict:
        container_id = self.create_image_container(ig_user_id=ig_user_id, image_url=image_url, caption=caption)
        self.wait_ready(container_id)
        publish_id = self.publish_container(ig_user_id=ig_user_id, container_id=container_id)
        permalink = self.get_permalink(publish_id)
        return {
            "container_id": container_id,
            "publish_id": publish_id,
            "permalink": permalink,
        }

    def delete_media(self, media_id: str) -> dict:
        logger.info("instagram_delete_media request media_id=%s", media_id)
        return self.delete(media_id)

    def archive_media(self, media_id: str) -> dict:
        attempts = [
            {"is_archived": "true"},
            {"is_hidden": "true"},
            {"archive": "true"},
        ]
        last_error: GraphApiError | None = None
        for payload in attempts:
            try:
                logger.info("instagram_archive_media request media_id=%s payload=%s", media_id, payload)
                return self.post(media_id, payload)
            except GraphApiError as exc:
                last_error = exc
                continue
        if last_error is None:
            raise GraphApiError("Unable to archive media item.", status_code=400)
        raise GraphApiError(
            "Archive is not supported for this media item/token. "
            "Meta's public Instagram Graph API does not provide a reliable archive endpoint for feed media. "
            f"Last Graph API error: {last_error}",
            status_code=max(400, last_error.status_code),
            payload=last_error.payload,
        )


@dataclass
class JobItem:
    id: str
    filename: str
    asset_id: str
    stored_path: str
    public_url: str
    status: str = "queued"
    message: str = "queued"
    caption: str = ""
    permalink: str | None = None


@dataclass
class PostJob:
    id: str
    ig_user_id: str
    created_at: str
    updated_at: str
    status: str
    total: int
    completed: int = 0
    failed: int = 0
    spinner_tick: int = 0
    items: list[JobItem] = field(default_factory=list)
    logs: list[str] = field(default_factory=list)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def convert_image_bytes_to_jpeg(image_bytes: bytes, *, quality: int = 95) -> tuple[bytes, str]:
    with Image.open(io.BytesIO(image_bytes)) as image:
        detected = (image.format or "unknown").upper()
        normalized = ImageOps.exif_transpose(image)
        rgb = normalized.convert("RGB")
        out = io.BytesIO()
        rgb.save(out, format="JPEG", quality=quality)
        return out.getvalue(), detected


class InstagramJobManager:
    def __init__(
        self,
        *,
        uploads_dir: Path,
        public_base_url: str,
        post_buffer_seconds: int = 10,
    ) -> None:
        self.uploads_dir = uploads_dir
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.public_base_url = public_base_url.rstrip("/")
        self.post_buffer_seconds = max(1, int(post_buffer_seconds))
        self.vision = VisionCaptionGenerator()
        self._jobs: dict[str, PostJob] = {}
        self._lock = threading.Lock()

    def _append_log(self, job: PostJob, line: str) -> None:
        timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        job.logs.append(f"[{timestamp}] {line}")
        job.logs = job.logs[-80:]

    def _set_status(self, job: PostJob, status: str) -> None:
        job.status = status
        job.updated_at = now_iso()

    def _tick_spinner(self, job: PostJob) -> None:
        job.spinner_tick += 1

    def _to_snapshot(self, job: PostJob) -> dict:
        return {
            "id": job.id,
            "ig_user_id": job.ig_user_id,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "status": job.status,
            "total": job.total,
            "completed": job.completed,
            "failed": job.failed,
            "spinner_tick": job.spinner_tick,
            "ascii_frame": ASCII_FRAMES[job.spinner_tick % len(ASCII_FRAMES)],
            "logs": job.logs[-20:],
            "items": [
                {
                    "id": item.id,
                    "filename": item.filename,
                    "asset_id": item.asset_id,
                    "public_url": item.public_url,
                    "status": item.status,
                    "message": item.message,
                    "caption": item.caption,
                    "permalink": item.permalink,
                }
                for item in job.items
            ],
        }

    def create_job(
        self,
        *,
        access_token: str,
        ig_user_id: str,
        uploads: list[tuple[str, bytes]],
        request_base_url: str,
    ) -> dict:
        if not uploads:
            raise ValueError("At least one image upload is required.")

        base_url = self.public_base_url or request_base_url.rstrip("/")
        created_at = now_iso()
        job = PostJob(
            id=uuid.uuid4().hex,
            ig_user_id=ig_user_id,
            created_at=created_at,
            updated_at=created_at,
            status="queued",
            total=len(uploads),
        )

        for filename, raw_bytes in uploads:
            asset_id = uuid.uuid4().hex
            jpeg_bytes, detected = convert_image_bytes_to_jpeg(raw_bytes)
            destination = self.uploads_dir / f"{asset_id}.jpg"
            destination.write_bytes(jpeg_bytes)
            public_url = f"{base_url}/api/instagram/uploads/{asset_id}"
            item = JobItem(
                id=uuid.uuid4().hex,
                filename=filename,
                asset_id=asset_id,
                stored_path=str(destination),
                public_url=public_url,
                status="queued",
                message=f"normalized as jpeg (source {detected})",
            )
            job.items.append(item)

        with self._lock:
            self._jobs[job.id] = job
            self._append_log(job, f"queued {job.total} image(s)")

        worker = threading.Thread(
            target=self._run_job,
            kwargs={
                "job_id": job.id,
                "access_token": access_token,
            },
            daemon=True,
        )
        worker.start()

        with self._lock:
            return self._to_snapshot(job)

    def _run_job(self, *, job_id: str, access_token: str) -> None:
        base_client = InstagramGraphClient(access_token)
        client = base_client
        token_source = "input_token"

        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            try:
                page_access_token = base_client.resolve_page_access_token_for_ig_user(job.ig_user_id)
                if page_access_token:
                    client = InstagramGraphClient(page_access_token)
                    token_source = "page_access_token"
            except GraphApiError as exc:
                self._append_log(job, f"could not resolve page token, using original token ({exc})")

            self._set_status(job, "processing")
            self._append_log(job, "mass post agent started")
            self._append_log(job, f"publish token source: {token_source}")

        for index in range(0, 10000):
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                if index >= len(job.items):
                    break
                item = job.items[index]
                item.status = "processing"
                item.message = "running vision + preparing caption"
                self._tick_spinner(job)
                self._append_log(job, f"processing {index + 1}/{job.total}: {item.filename}")

            try:
                analysis = self.vision.analyze_image(Path(item.stored_path))
                caption = self.vision.build_caption(analysis)
                publish = client.publish_photo(
                    ig_user_id=job.ig_user_id,
                    image_url=item.public_url,
                    caption=caption,
                )

                with self._lock:
                    job = self._jobs.get(job_id)
                    if job is None:
                        return
                    item = job.items[index]
                    item.status = "posted"
                    item.message = "published"
                    item.caption = caption
                    item.permalink = publish.get("permalink")
                    job.completed += 1
                    self._tick_spinner(job)
                    self._append_log(job, f"posted {index + 1}/{job.total}: {item.filename}")
            except Exception as exc:
                with self._lock:
                    job = self._jobs.get(job_id)
                    if job is None:
                        return
                    item = job.items[index]
                    item.status = "failed"
                    item.message = str(exc)
                    job.failed += 1
                    self._tick_spinner(job)
                    self._append_log(job, f"failed {index + 1}/{job.total}: {item.filename} -> {exc}")

            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                has_more = index < len(job.items) - 1
                self._tick_spinner(job)
                if has_more:
                    self._append_log(job, f"waiting {self.post_buffer_seconds}s buffer before next publish")

            if index < len(job.items) - 1:
                time.sleep(self.post_buffer_seconds)

        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return

            if job.completed == job.total and job.failed == 0:
                final_status = "completed"
            elif job.completed > 0:
                final_status = "partial"
            else:
                final_status = "failed"

            self._set_status(job, final_status)
            self._append_log(job, f"job finished with status={final_status} (posted={job.completed}, failed={job.failed})")

    def get_job(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return self._to_snapshot(job)


def resolve_context_and_media(*, access_token: str, media_limit: int = 50) -> dict:
    client = InstagramGraphClient(access_token)
    context = client.resolve_instagram_account()
    media_payload = client.list_media_page(context["ig_user_id"], limit=media_limit)
    return {
        "page_id": context["page_id"],
        "page_name": context["page_name"],
        "ig_user_id": context["ig_user_id"],
        "profile": context["profile"],
        "media": media_payload["media"],
        "next_cursor": media_payload["next_cursor"],
    }


def fetch_media_for_account(
    *,
    access_token: str,
    ig_user_id: str,
    media_limit: int = 50,
    after_cursor: str | None = None,
) -> dict:
    client = InstagramGraphClient(access_token)
    profile = client.get_ig_profile(ig_user_id)
    media_payload = client.list_media_page(
        ig_user_id,
        limit=media_limit,
        after_cursor=after_cursor,
    )
    return {
        "ig_user_id": ig_user_id,
        "profile": profile,
        "media": media_payload["media"],
        "next_cursor": media_payload["next_cursor"],
    }


def run_bulk_media_action(
    *,
    access_token: str,
    action: str,
    media_ids: list[str],
    ig_user_id: str | None = None,
) -> dict:
    base_client = InstagramGraphClient(access_token)
    normalized_ids = [item.strip() for item in media_ids if item.strip()]

    if not normalized_ids:
        raise ValueError("No media IDs were supplied.")

    action_client = base_client
    token_source = "input_token"
    normalized_ig_user_id = str(ig_user_id or "").strip()

    if normalized_ig_user_id:
        try:
            page_access_token = base_client.resolve_page_access_token_for_ig_user(normalized_ig_user_id)
            if page_access_token:
                action_client = InstagramGraphClient(page_access_token)
                token_source = "page_access_token"
        except GraphApiError as exc:
            logger.warning(
                "could not resolve page access token for ig_user_id=%s; falling back to input token: %s",
                normalized_ig_user_id,
                exc,
            )

    successes: list[dict] = []
    failures: list[dict] = []
    logs: list[str] = [f"bulk action={action} token_source={token_source} items={len(normalized_ids)}"]

    for media_id in normalized_ids:
        try:
            logs.append(f"start {action} media_id={media_id}")
            if action == "delete":
                response = action_client.delete_media(media_id)
            else:
                response = action_client.archive_media(media_id)
            logger.info("bulk_action success action=%s media_id=%s", action, media_id)
            logs.append(f"success media_id={media_id}")
            successes.append(
                {
                    "media_id": media_id,
                    "response": response,
                }
            )
        except Exception as exc:
            logger.warning("bulk_action failure action=%s media_id=%s error=%s", action, media_id, exc)
            logs.append(f"failed media_id={media_id} error={exc}")
            failures.append(
                {
                    "media_id": media_id,
                    "error": str(exc),
                }
            )

    status = "completed" if not failures else ("partial" if successes else "failed")
    return {
        "status": status,
        "action": action,
        "token_source": token_source,
        "logs": logs[-120:],
        "successes": successes,
        "failures": failures,
    }


def build_job_manager() -> InstagramJobManager:
    service_dir = Path(__file__).resolve().parent.parent
    uploads_dir = service_dir / "runtime" / "instagram_uploads"
    configured_base_url = os.getenv("INSTAGRAM_PUBLIC_BASE_URL", "").strip()
    post_buffer_seconds = int(os.getenv("INSTAGRAM_POST_BUFFER_SECONDS", "10") or "10")
    return InstagramJobManager(
        uploads_dir=uploads_dir,
        public_base_url=configured_base_url,
        post_buffer_seconds=post_buffer_seconds,
    )


def is_valid_asset_id(asset_id: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-f]{32}", asset_id))
