#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import mimetypes
import os
import random
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo


try:
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")
except Exception:
    MOSCOW_TZ = timezone(timedelta(hours=3))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
DEFAULT_DB_PATH = os.path.join(SCRIPT_DIR, "tg_events.sqlite")
DEFAULT_EXPORT_PATH = os.path.join(PUBLIC_DIR, "assets", "data", "events.json")
DEFAULT_HOME_EXPORT_PATH = os.path.join(PUBLIC_DIR, "assets", "data", "home-announcements.json")
DEFAULT_CHECKPOINT_PATH = os.path.join(SCRIPT_DIR, "checkpoint.json")
DEFAULT_MEDIA_CACHE_DIR = os.path.join(PUBLIC_DIR, "assets", "img", "parser")
DEFAULT_MEDIA_URL_PREFIX = "assets/img/parser"
ROLL_TO_NEXT_YEAR_THRESHOLD_DAYS = 180
MAX_HOME_DELTA_DAYS = 120
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}

RU_MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}

EVENT_HINT_HASHTAGS = ("#анонс", "#ивенты", "#дайджест", "#мероприятия", "#opentalk")
EVENT_HINT_WORDS = (
    "регистрация",
    "дата",
    "время",
    "место",
    "встреча",
    "лекция",
    "мастер-класс",
    "воркшоп",
    "open talk",
    "opentalk",
    "питч",
    "форум",
    "мероприят",
)
DIGEST_HINT_WORDS = ("дайджест", "регистрация на события", "подборка событий")
DATE_CONTEXT_HINTS = ("дата", "когда", "начало", "старт", "состоится", "пройдет", "пройдёт", "📅", "🗓")
DATE_PENALTY_HINTS = ("дедлайн", "прием заявок", "приём заявок", "регистрация до", "заявки до", "подачи заявки")
WEEKDAY_HINTS = ("понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье")
ANNOUNCEMENT_HINT_WORDS = (
    "регистрация",
    "ждем вас",
    "ждём вас",
    "open talk",
    "лекция",
    "воркшоп",
    "мастер-класс",
    "питч",
    "форум",
    "дата:",
    "время:",
    "место:",
)
RECAP_HINT_WORDS = (
    "фотографии со встречи",
    "фотографии с встречи",
    "выступил на",
    "выступила на",
    "рассказал на",
    "рассказала на",
    "поделился",
    "поделилась",
    "итоги",
    "обратный отсчёт",
    "обратный отсчет",
)
GENERIC_DIGEST_TITLES = {"событие из дайджеста", "регистрация", "подробнее", "ссылка"}
NON_REGISTRATION_LINK_PATTERNS = (
    "vk.com/album",
    "vk.ru/album",
    "instagram.com/p/",
    "instagram.com/reel/",
    "youtube.com/watch",
    "youtu.be/",
)
REGISTRATION_HOST_HINTS = (
    "timepad",
    "forms.gle",
    "docs.google.com",
    "forms.yandex",
    "leader-id",
    "event",
    "ticket",
    "afisha",
)
FALLBACK_EVENT_IMAGES = [
    "assets/img/event-01-tsypkin.jpg",
    "assets/img/event-02-pitch.jpg",
    "assets/img/event-03-alyasov.jpg",
    "assets/img/event-04-ryasova.jpg",
    "assets/img/events.jpg",
]
FALLBACK_IMAGE_RULES = (
    (("форум", "forum"), "assets/img/Forum.jpg"),
    (("акселератор", "accelerator"), "assets/img/Accelerator.png"),
    (("питч", "pitch"), "assets/img/event-02-pitch.jpg"),
    (("open talk", "opentalk"), "assets/img/event-03-alyasov.jpg"),
    (("лекц", "воркшоп", "мастер"), "assets/img/event-04-ryasova.jpg"),
)
MEDIA_SELECTORS = (
    "a.tgme_widget_message_photo_wrap",
    ".tgme_widget_message_grouped_wrap a.tgme_widget_message_photo_wrap",
    ".tgme_widget_message_grouped_layer",
    ".tgme_widget_message_link_preview_image",
    ".tgme_widget_message_video_thumb",
)


class MissingDependencyError(RuntimeError):
    pass


def require_requests() -> Any:
    try:
        import requests
    except ImportError as exc:
        raise MissingDependencyError(
            "Missing dependency: requests. Install with `pip install -r requirements.txt`."
        ) from exc
    return requests


def require_bs4() -> Any:
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise MissingDependencyError(
            "Missing dependency: beautifulsoup4. Install with `pip install -r requirements.txt`."
        ) from exc
    return BeautifulSoup


@dataclass
class TelegramPost:
    channel: str
    post_id: int
    post_url: str
    published_at: Optional[datetime]
    text: str
    links: List[Tuple[str, str]]
    media_urls: List[str]


@dataclass
class Event:
    channel: str
    source_post_id: int
    source_post_url: str
    published_at: Optional[str]
    title: str
    start_at: Optional[str]
    location: Optional[str]
    registration_url: Optional[str]
    raw_text: str
    content_kind: str
    cover_image: Optional[str]
    gallery: List[str]


def now_iso() -> str:
    return datetime.now(tz=MOSCOW_TZ).isoformat()


def clean_text(value: str) -> str:
    text = str(value or "").replace("\u00a0", " ").replace("\u200b", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def sha1(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()


def atomic_write_json(path: str, payload: dict) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, path)


def atomic_write_bytes(path: str, payload: bytes) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "wb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, path)


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=MOSCOW_TZ)
    return parsed.astimezone(MOSCOW_TZ)


def to_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=MOSCOW_TZ)
    return value.astimezone(MOSCOW_TZ).isoformat()


def normalize_title(value: str) -> str:
    title = clean_text(value)
    title = title.strip(" -–—•▪·|:;,")
    title = re.sub(r"\s{2,}", " ", title)
    return title


def is_probably_noise_title(value: str) -> bool:
    title = normalize_title(value)
    lowered = title.lower()
    if not title:
        return True
    if lowered in GENERIC_DIGEST_TITLES:
        return True
    if title.startswith("#") or title.startswith("@"):
        return True
    if not re.search(r"[A-Za-zА-Яа-яЁё0-9]", title):
        return True
    if re.fullmatch(r"[-–—•▪·|:;,. ]+", title):
        return True
    return len(re.sub(r"[^A-Za-zА-Яа-яЁё0-9]+", "", title)) < 3


def normalize_event_title(value: str) -> str:
    title = normalize_title(value)
    return title[:200] if title else "Событие"


def canonical_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    normalized = clean_text(url)
    parsed = urlparse(normalized)
    if not parsed.scheme and not parsed.netloc:
        return normalized
    path = parsed.path.rstrip("/") or "/"
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}{query}"


def normalize_asset_path(value: str) -> str:
    candidate = clean_text(value)
    if candidate.startswith("/"):
        candidate = candidate[1:]
    return candidate


def is_local_asset_path(value: Optional[str]) -> bool:
    candidate = normalize_asset_path(value or "")
    return candidate.startswith("assets/")


def is_remote_http_url(value: Optional[str]) -> bool:
    if not value:
        return False
    parsed = urlparse(clean_text(value))
    return parsed.scheme.lower() in {"http", "https"} and bool(parsed.netloc)


def guess_image_extension(source_url: str, content_type: str) -> str:
    ext = os.path.splitext(urlparse(source_url).path)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        return ext
    guessed = mimetypes.guess_extension((content_type or "").split(";", 1)[0].strip().lower() or "")
    if guessed in IMAGE_EXTENSIONS:
        return guessed
    if guessed == ".jpe":
        return ".jpg"
    return ".jpg"


def media_cache_basename(channel: str, source_post_id: int, ordinal: int) -> str:
    safe_channel = re.sub(r"[^a-zA-Z0-9_-]+", "-", clean_text(channel) or "channel").strip("-") or "channel"
    return f"{safe_channel}-{source_post_id}-{ordinal:02d}"


def find_cached_media_relative_path(
    channel: str,
    source_post_id: int,
    ordinal: int,
    media_cache_dir: str,
    media_url_prefix: str,
) -> Optional[str]:
    basename = media_cache_basename(channel, source_post_id, ordinal)
    if not os.path.isdir(media_cache_dir):
        return None
    for entry in os.scandir(media_cache_dir):
        if not entry.is_file():
            continue
        filename = entry.name
        if not filename.startswith(f"{basename}."):
            continue
        ext = os.path.splitext(filename)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            return f"{media_url_prefix.rstrip('/')}/{filename}"
    return None


def cache_remote_image(
    session: Any,
    source_url: str,
    channel: str,
    source_post_id: int,
    ordinal: int,
    media_cache_dir: str,
    media_url_prefix: str,
) -> Optional[str]:
    cached_path = find_cached_media_relative_path(channel, source_post_id, ordinal, media_cache_dir, media_url_prefix)
    if cached_path:
        return cached_path

    response = get_with_retries(session, url=source_url, timeout=45)
    payload = response.content
    if not payload:
        return None

    content_type = response.headers.get("Content-Type", "")
    if content_type and not content_type.lower().startswith("image/"):
        logging.warning("Skip non-image media for post %s/%s: %s (%s)", channel, source_post_id, source_url, content_type)
        return None

    ext = guess_image_extension(source_url, content_type)
    filename = f"{media_cache_basename(channel, source_post_id, ordinal)}{ext}"
    abs_path = os.path.join(media_cache_dir, filename)
    atomic_write_bytes(abs_path, payload)
    return f"{media_url_prefix.rstrip('/')}/{filename}"


def localize_media_url(
    session: Optional[Any],
    media_url: Optional[str],
    channel: str,
    source_post_id: int,
    ordinal: int,
    media_cache_dir: str,
    media_url_prefix: str,
) -> Optional[str]:
    candidate = clean_text(media_url or "")
    if not candidate:
        return None
    if is_local_asset_path(candidate):
        return normalize_asset_path(candidate)
    if not is_remote_http_url(candidate):
        return candidate

    cached_path = find_cached_media_relative_path(channel, source_post_id, ordinal, media_cache_dir, media_url_prefix)
    if cached_path:
        return cached_path
    if session is None:
        return None

    try:
        return cache_remote_image(
            session=session,
            source_url=candidate,
            channel=channel,
            source_post_id=source_post_id,
            ordinal=ordinal,
            media_cache_dir=media_cache_dir,
            media_url_prefix=media_url_prefix,
        )
    except Exception as exc:
        logging.warning("Failed to cache media for post %s/%s: %s", channel, source_post_id, exc)
        return None


def is_telegram_internal_url(url: Optional[str]) -> bool:
    if not url:
        return True
    lowered = url.lower()
    if lowered.startswith("tg://") or lowered.startswith("?q="):
        return True
    parsed = urlparse(lowered)
    if not parsed.scheme and not parsed.netloc:
        return True
    return parsed.netloc.endswith("t.me") or parsed.netloc.endswith("telegram.me")


def is_non_registration_url(url: Optional[str]) -> bool:
    if not url:
        return True
    lowered = url.lower()
    if is_telegram_internal_url(lowered):
        return True
    return any(pattern in lowered for pattern in NON_REGISTRATION_LINK_PATTERNS)


def score_registration_link(url: str, anchor_text: str) -> int:
    if is_non_registration_url(url):
        return -100
    lowered_url = url.lower()
    lowered_text = clean_text(anchor_text).lower()
    score = 10
    if any(host_hint in lowered_url for host_hint in REGISTRATION_HOST_HINTS):
        score += 25
    if any(word in lowered_url for word in ("register", "registration", "signup", "apply", "event")):
        score += 15
    if any(word in lowered_text for word in ("регистрация", "зарегистр", "подать заявку", "signup")):
        score += 12
    if any(word in lowered_text for word in ("фото", "альбом", "видео", "итоги")):
        score -= 40
    return score


def choose_registration_url(links: List[Tuple[str, str]]) -> Optional[str]:
    best_score = 0
    best_url: Optional[str] = None
    for href, anchor_text in links:
        score = score_registration_link(href, anchor_text)
        if score > best_score:
            best_score = score
            best_url = href
    return best_url


def maybe_roll_to_next_year(candidate: datetime, base: datetime) -> datetime:
    if candidate >= base - timedelta(days=7):
        return candidate
    if (base - candidate).days >= ROLL_TO_NEXT_YEAR_THRESHOLD_DAYS:
        return candidate.replace(year=candidate.year + 1)
    return candidate


def safe_build_datetime(year: int, month: int, day: int, hour: int, minute: int) -> Optional[datetime]:
    try:
        return datetime(year, month, day, hour, minute, tzinfo=MOSCOW_TZ)
    except ValueError:
        return None


def parse_datetime_fragment(fragment: str, base: datetime) -> Optional[datetime]:
    text = (fragment or "").lower()

    for match in re.finditer(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?!\d)", text):
        day = int(match.group(1))
        month = int(match.group(2))
        year = int(match.group(3))
        if year < 100:
            year += 2000
        if year < base.year - 1 or year > base.year + 2:
            continue
        hour, minute = 0, 0
        time_match = re.search(r"(\d{1,2}):(\d{2})", text[match.end(): match.end() + 80])
        if time_match:
            hour, minute = int(time_match.group(1)), int(time_match.group(2))
        candidate = safe_build_datetime(year, month, day, hour, minute)
        if candidate:
            return candidate

    for match in re.finditer(
        r"(?<!\d)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?",
        text,
    ):
        day = int(match.group(1))
        month = RU_MONTHS.get(match.group(2), 0)
        year = int(match.group(3)) if match.group(3) else base.year
        if match.group(3) and (year < base.year - 1 or year > base.year + 2):
            continue
        hour, minute = 0, 0
        time_match = re.search(r"(\d{1,2}):(\d{2})", text[match.end(): match.end() + 100])
        if time_match:
            hour, minute = int(time_match.group(1)), int(time_match.group(2))
        candidate = safe_build_datetime(year, month, day, hour, minute)
        if not candidate:
            continue
        if not match.group(3):
            candidate = maybe_roll_to_next_year(candidate, base)
        return candidate

    for match in re.finditer(r"(?<!\d)(\d{1,2})[./](\d{1,2})(?![./]\d)", text):
        day = int(match.group(1))
        month = int(match.group(2))
        hour, minute = 0, 0
        time_match = re.search(r"(\d{1,2}):(\d{2})", text[match.end(): match.end() + 80])
        if time_match:
            hour, minute = int(time_match.group(1)), int(time_match.group(2))
        candidate = safe_build_datetime(base.year, month, day, hour, minute)
        if candidate:
            return maybe_roll_to_next_year(candidate, base)

    return None


def build_date_search_fragments(text: str) -> List[str]:
    lines = [clean_text(line) for line in (text or "").splitlines() if clean_text(line)]
    fragments: List[Tuple[int, int, str]] = []

    for index, line in enumerate(lines):
        lowered = line.lower()
        score = 0
        has_numeric_date = bool(re.search(r"(?<!\d)\d{1,2}[./]\d{1,2}([./]\d{2,4})?(?!\d)", lowered))
        has_textual_date = any(month in lowered for month in RU_MONTHS)
        has_time = bool(re.search(r"\b\d{1,2}:\d{2}\b", lowered))

        if has_numeric_date or has_textual_date:
            score += 4
        if has_time:
            score += 2
        if any(hint in lowered for hint in DATE_CONTEXT_HINTS):
            score += 5
        if any(day in lowered for day in WEEKDAY_HINTS):
            score += 1
        if any(penalty in lowered for penalty in DATE_PENALTY_HINTS):
            score -= 6
        if "заяв" in lowered and "до" in lowered:
            score -= 4

        if score > 0:
            fragments.append((score, index, line))
            if any(hint in lowered for hint in ("дата", "когда")) and index + 1 < len(lines):
                fragments.append((score - 1, index + 1, lines[index + 1]))

    fragments.sort(key=lambda item: (-item[0], item[1]))

    result: List[str] = []
    seen = set()
    for _, _, fragment in fragments:
        if fragment in seen:
            continue
        result.append(fragment)
        seen.add(fragment)
    return result


def parse_ru_datetime_from_text(text: str, base: Optional[datetime]) -> Optional[datetime]:
    base_dt = base or datetime.now(tz=MOSCOW_TZ)
    for fragment in build_date_search_fragments(text):
        candidate = parse_datetime_fragment(fragment, base_dt)
        if candidate:
            return candidate

    return None


def is_eventish_post(text: str) -> bool:
    lowered = (text or "").lower()
    if any(tag in lowered for tag in EVENT_HINT_HASHTAGS):
        return True
    if any(word in lowered for word in EVENT_HINT_WORDS):
        return True
    return parse_ru_datetime_from_text(text, None) is not None


def pick_title(text: str) -> str:
    skip_prefixes = ("дата", "время", "место", "регистрация", "#", "@")
    for raw_line in (text or "").splitlines():
        line = normalize_title(raw_line)
        if not line or line.lower().startswith(skip_prefixes):
            continue
        if is_probably_noise_title(line):
            continue
        return line[:200]
    return "Событие"


def pick_location(text: str) -> Optional[str]:
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        match = re.search(r"(?i)\b(место|локация|где)\b\s*[:\-]\s*(.+)$", line)
        if match:
            location = clean_text(match.group(2))
            return location[:240] if location else None
    return None


def is_digest_post(text: str, links: List[Tuple[str, str]]) -> bool:
    lowered = (text or "").lower()
    external_links = [href for href, _ in links if not is_telegram_internal_url(href)]
    return len(external_links) >= 2 and any(word in lowered for word in DIGEST_HINT_WORDS)


def detect_content_kind(text: str, start_dt: Optional[datetime], digest: bool, title: str = "") -> str:
    lowered = (text or "").lower()
    title_lowered = (title or "").lower()
    if digest:
        return "digest"
    if "дайджест" in title_lowered or any(word in lowered for word in DIGEST_HINT_WORDS):
        return "digest"
    if "обратный отсч" in title_lowered:
        return "recap"
    if any(word in title_lowered for word in ("выступил", "выступила", "рассказал", "рассказала", "итоги")):
        return "recap"
    if any(word in lowered for word in RECAP_HINT_WORDS) and start_dt is None:
        return "recap"
    if start_dt is not None:
        return "announcement"
    if any(word in title_lowered for word in ("open talk", "питч", "форум", "лекция", "воркшоп", "мастер-класс", "открылась запись")):
        return "announcement"
    if any(word in lowered for word in ANNOUNCEMENT_HINT_WORDS):
        return "announcement"
    return "other"


def extract_background_urls(style_value: str, base_url: str) -> List[str]:
    urls: List[str] = []
    for match in re.finditer(r"url\((['\"]?)(.*?)\1\)", style_value or "", flags=re.IGNORECASE):
        candidate = clean_text(match.group(2))
        if not candidate:
            continue
        if candidate.startswith("//"):
            candidate = f"https:{candidate}"
        urls.append(urljoin(base_url, candidate))
    return urls


def pick_fallback_cover_image(title: str, content_kind: str) -> str:
    lowered = title.lower()
    for hints, image_path in FALLBACK_IMAGE_RULES:
        if any(hint in lowered for hint in hints):
            return image_path
    if content_kind == "digest":
        return "assets/img/events.jpg"
    return FALLBACK_EVENT_IMAGES[int(sha1(title)[:6], 16) % len(FALLBACK_EVENT_IMAGES)]


def event_cover(media_urls: List[str], title: str, content_kind: str) -> Tuple[str, List[str]]:
    gallery: List[str] = []
    seen = set()
    for media_url in media_urls:
        if not media_url or media_url in seen:
            continue
        gallery.append(media_url)
        seen.add(media_url)
    if gallery:
        return gallery[0], gallery
    fallback = pick_fallback_cover_image(title, content_kind)
    return fallback, [fallback]


def event_key(event: Event) -> str:
    base = "|".join(
        [
            event.channel,
            str(event.source_post_id),
            normalize_event_title(event.title).lower(),
            event.start_at or "",
            canonical_url(event.registration_url) or "",
            event.content_kind,
        ]
    )
    return sha1(base)


def extract_media_urls(message_node: Any, base_url: str) -> List[str]:
    urls: List[str] = []
    for selector in MEDIA_SELECTORS:
        for node in message_node.select(selector):
            urls.extend(extract_background_urls(node.get("style") or "", base_url))
            src = clean_text(node.get("src") or "")
            if src:
                urls.append(urljoin(base_url, src))
    unique: List[str] = []
    seen = set()
    for url in urls:
        if not url or url in seen:
            continue
        unique.append(url)
        seen.add(url)
    return unique


def parse_posts_from_html(html: str, channel: str) -> List[TelegramPost]:
    BeautifulSoup = require_bs4()
    soup = BeautifulSoup(html, "html.parser")
    posts: List[TelegramPost] = []

    for message in soup.select("div.tgme_widget_message"):
        data_post = clean_text(message.get("data-post") or "")
        if "/" not in data_post:
            continue

        try:
            _, raw_post_id = data_post.split("/", 1)
            post_id = int(raw_post_id)
        except ValueError:
            continue

        post_url = f"https://t.me/{data_post}"
        published_at = None

        time_tag = message.select_one("a.tgme_widget_message_date time")
        if time_tag and time_tag.get("datetime"):
            published_at = parse_iso_datetime(time_tag["datetime"])

        text_node = message.select_one("div.tgme_widget_message_text")
        text = clean_text(text_node.get_text("\n") if text_node else "")

        links: List[Tuple[str, str]] = []
        if text_node:
            for anchor in text_node.select("a[href]"):
                raw_href = clean_text(anchor.get("href") or "")
                if not raw_href:
                    continue
                href = raw_href if raw_href.startswith("?") else urljoin(post_url, raw_href)
                anchor_text = clean_text(anchor.get_text(" ", strip=True)) or href
                links.append((href, anchor_text))

        unique_links: List[Tuple[str, str]] = []
        seen_hrefs = set()
        for href, anchor_text in links:
            if href in seen_hrefs:
                continue
            unique_links.append((href, anchor_text))
            seen_hrefs.add(href)

        posts.append(
            TelegramPost(
                channel=channel,
                post_id=post_id,
                post_url=post_url,
                published_at=published_at,
                text=text,
                links=unique_links,
                media_urls=extract_media_urls(message, post_url),
            )
        )

    posts.sort(key=lambda post: post.post_id, reverse=True)
    return posts


def make_event(
    post: TelegramPost,
    title: str,
    content_kind: str,
    start_dt: Optional[datetime],
    location: Optional[str],
    registration_url: Optional[str],
) -> Event:
    normalized_title = normalize_event_title(title)
    cover_image, gallery = event_cover(post.media_urls, normalized_title, content_kind)
    return Event(
        channel=post.channel,
        source_post_id=post.post_id,
        source_post_url=post.post_url,
        published_at=to_iso(post.published_at),
        title=normalized_title,
        start_at=to_iso(start_dt),
        location=location,
        registration_url=registration_url,
        raw_text=post.text,
        content_kind=content_kind,
        cover_image=cover_image,
        gallery=gallery,
    )


def localize_event_media(
    event: Event,
    session: Optional[Any],
    media_cache_dir: str,
    media_url_prefix: str,
) -> bool:
    source_gallery = event.gallery or ([event.cover_image] if event.cover_image else [])
    localized_gallery: List[str] = []

    for ordinal, media_url in enumerate(source_gallery, start=1):
        localized = localize_media_url(
            session=session,
            media_url=media_url,
            channel=event.channel,
            source_post_id=event.source_post_id,
            ordinal=ordinal,
            media_cache_dir=media_cache_dir,
            media_url_prefix=media_url_prefix,
        )
        if localized:
            localized_gallery.append(localized)

    fallback = pick_fallback_cover_image(event.title, event.content_kind)
    next_gallery = localized_gallery or [normalize_asset_path(fallback)]
    next_cover = next_gallery[0]
    changed = event.cover_image != next_cover or event.gallery != next_gallery
    event.cover_image = next_cover
    event.gallery = next_gallery
    return changed


def localize_event_dict_media(
    event: dict,
    session: Optional[Any],
    media_cache_dir: str,
    media_url_prefix: str,
) -> bool:
    source_gallery = event.get("gallery") or ([event.get("cover_image")] if event.get("cover_image") else [])
    localized_gallery: List[str] = []

    for ordinal, media_url in enumerate(source_gallery, start=1):
        localized = localize_media_url(
            session=session,
            media_url=media_url,
            channel=event.get("channel") or "channel",
            source_post_id=int(event.get("source_post_id") or 0),
            ordinal=ordinal,
            media_cache_dir=media_cache_dir,
            media_url_prefix=media_url_prefix,
        )
        if localized:
            localized_gallery.append(localized)

    fallback = pick_fallback_cover_image(event.get("title") or "", event.get("content_kind") or "other")
    next_gallery = localized_gallery or [normalize_asset_path(fallback)]
    next_cover = next_gallery[0]
    changed = event.get("cover_image") != next_cover or event.get("gallery") != next_gallery
    event["cover_image"] = next_cover
    event["gallery"] = next_gallery
    return changed


def extract_digest_events(post: TelegramPost) -> List[Event]:
    events: List[Event] = []
    for href, anchor_text in post.links:
        if is_non_registration_url(href):
            continue
        title = normalize_title(anchor_text)
        if is_probably_noise_title(title):
            continue
        events.append(
            make_event(
                post=post,
                title=title,
                content_kind="digest",
                start_dt=None,
                location=None,
                registration_url=href,
            )
        )
    return events


def extract_events_from_post(post: TelegramPost) -> List[Event]:
    digest = is_digest_post(post.text, post.links)
    if digest:
        digest_events = extract_digest_events(post)
        if digest_events:
            return digest_events

    title = pick_title(post.text)
    if is_probably_noise_title(title):
        return []

    start_dt = parse_ru_datetime_from_text(post.text, post.published_at)
    location = pick_location(post.text)
    registration_url = choose_registration_url(post.links)
    content_kind = detect_content_kind(post.text, start_dt, digest=False, title=title)

    if content_kind == "other" and start_dt is None and registration_url is None:
        return []

    return [
        make_event(
            post=post,
            title=title,
            content_kind=content_kind,
            start_dt=start_dt,
            location=location,
            registration_url=registration_url,
        )
    ]


def db_connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def ensure_column(conn: sqlite3.Connection, table_name: str, column_name: str, definition: str) -> None:
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}
    if column_name not in existing:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def db_init(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS posts(
            channel TEXT NOT NULL,
            post_id INTEGER NOT NULL,
            post_url TEXT NOT NULL,
            published_at TEXT,
            text TEXT,
            links_json TEXT,
            text_hash TEXT,
            scraped_at TEXT,
            PRIMARY KEY(channel, post_id)
        );

        CREATE TABLE IF NOT EXISTS events(
            channel TEXT NOT NULL,
            event_key TEXT PRIMARY KEY,
            source_post_id INTEGER NOT NULL,
            source_post_url TEXT NOT NULL,
            published_at TEXT,
            title TEXT NOT NULL,
            start_at TEXT,
            location TEXT,
            registration_url TEXT,
            raw_text TEXT,
            created_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_events_channel_post ON events(channel, source_post_id);

        CREATE TABLE IF NOT EXISTS missing_posts(
            channel TEXT NOT NULL,
            post_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            tries INTEGER NOT NULL DEFAULT 0,
            last_checked_at TEXT,
            note TEXT,
            PRIMARY KEY(channel, post_id)
        );
        """
    )
    ensure_column(conn, "posts", "media_json", "TEXT")
    ensure_column(conn, "posts", "updated_at", "TEXT")
    ensure_column(conn, "events", "content_kind", "TEXT")
    ensure_column(conn, "events", "cover_image", "TEXT")
    ensure_column(conn, "events", "gallery_json", "TEXT")
    ensure_column(conn, "events", "updated_at", "TEXT")
    conn.commit()


def db_existing_post_ids(conn: sqlite3.Connection, channel: str, ids: List[int]) -> set:
    if not ids:
        return set()
    placeholders = ",".join(["?"] * len(ids))
    rows = conn.execute(
        f"SELECT post_id FROM posts WHERE channel=? AND post_id IN ({placeholders})",
        [channel, *ids],
    ).fetchall()
    return {row[0] for row in rows}


def post_hash(post: TelegramPost) -> str:
    payload = {"text": post.text, "links": post.links, "media_urls": post.media_urls}
    return sha1(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def db_upsert_post(conn: sqlite3.Connection, post: TelegramPost) -> bool:
    links_json = json.dumps([{"href": href, "text": text} for href, text in post.links], ensure_ascii=False)
    media_json = json.dumps(post.media_urls, ensure_ascii=False)
    content_hash = post_hash(post)

    existing = conn.execute(
        "SELECT text_hash FROM posts WHERE channel=? AND post_id=?",
        (post.channel, post.post_id),
    ).fetchone()
    changed = existing is None or existing[0] != content_hash

    with conn:
        conn.execute(
            """
            INSERT INTO posts(channel, post_id, post_url, published_at, text, links_json, media_json, text_hash, scraped_at, updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(channel, post_id) DO UPDATE SET
                post_url=excluded.post_url,
                published_at=excluded.published_at,
                text=excluded.text,
                links_json=excluded.links_json,
                media_json=excluded.media_json,
                text_hash=excluded.text_hash,
                scraped_at=excluded.scraped_at,
                updated_at=excluded.updated_at
            """,
            (
                post.channel,
                post.post_id,
                post.post_url,
                to_iso(post.published_at),
                post.text,
                links_json,
                media_json,
                content_hash,
                now_iso(),
                now_iso(),
            ),
        )
    return changed


def db_replace_events_for_post(conn: sqlite3.Connection, post: TelegramPost, events: List[Event]) -> int:
    inserted = 0
    with conn:
        conn.execute(
            "DELETE FROM events WHERE channel=? AND source_post_id=?",
            (post.channel, post.post_id),
        )
        for event in events:
            conn.execute(
                """
                INSERT INTO events(
                    channel, event_key, source_post_id, source_post_url, published_at,
                    title, start_at, location, registration_url, raw_text,
                    content_kind, cover_image, gallery_json, created_at, updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    event.channel,
                    event_key(event),
                    event.source_post_id,
                    event.source_post_url,
                    event.published_at,
                    event.title,
                    event.start_at,
                    event.location,
                    event.registration_url,
                    event.raw_text,
                    event.content_kind,
                    event.cover_image,
                    json.dumps(event.gallery, ensure_ascii=False),
                    now_iso(),
                    now_iso(),
                ),
            )
            inserted += 1
    return inserted


def db_mark_missing(conn: sqlite3.Connection, channel: str, post_id: int, status: str, note: str = "") -> None:
    with conn:
        conn.execute(
            """
            INSERT INTO missing_posts(channel, post_id, status, tries, last_checked_at, note)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(channel, post_id) DO UPDATE SET
                status=excluded.status,
                tries=missing_posts.tries + 1,
                last_checked_at=excluded.last_checked_at,
                note=excluded.note
            """,
            (channel, post_id, status, 1, now_iso(), note),
        )


def db_min_max_post_id(conn: sqlite3.Connection, channel: str) -> Tuple[Optional[int], Optional[int]]:
    row = conn.execute(
        "SELECT MIN(post_id), MAX(post_id) FROM posts WHERE channel=?",
        (channel,),
    ).fetchone()
    return row[0], row[1]


def db_missing_ids_in_range(conn: sqlite3.Connection, channel: str, start_id: int, end_id: int, limit: int) -> List[int]:
    existing = conn.execute(
        "SELECT post_id FROM posts WHERE channel=? AND post_id BETWEEN ? AND ?",
        (channel, start_id, end_id),
    ).fetchall()
    existing_set = {row[0] for row in existing}

    not_found = conn.execute(
        "SELECT post_id FROM missing_posts WHERE channel=? AND status='not_found' AND post_id BETWEEN ? AND ?",
        (channel, start_id, end_id),
    ).fetchall()
    not_found_set = {row[0] for row in not_found}

    missing: List[int] = []
    for post_id in range(start_id, end_id + 1):
        if post_id in existing_set or post_id in not_found_set:
            continue
        missing.append(post_id)
        if len(missing) >= limit:
            break
    return missing


def sanitize_event_row(row: Tuple[Any, ...]) -> dict:
    gallery_raw = row[11] if len(row) > 11 else None
    try:
        gallery = json.loads(gallery_raw) if gallery_raw else []
    except json.JSONDecodeError:
        gallery = []

    title = normalize_event_title(row[4])
    raw_text = row[8] or ""
    published_at = row[3]
    stored_start_dt = parse_iso_datetime(row[5])
    reparsed_start_dt = parse_ru_datetime_from_text(raw_text, parse_iso_datetime(published_at))
    start_at = row[5]
    if reparsed_start_dt:
        if stored_start_dt is None:
            start_at = to_iso(reparsed_start_dt)
        elif published_at:
            published_dt = parse_iso_datetime(published_at)
            if published_dt:
                stored_delta = abs((stored_start_dt - published_dt).days)
                reparsed_delta = abs((reparsed_start_dt - published_dt).days)
                if reparsed_delta + 14 < stored_delta:
                    start_at = to_iso(reparsed_start_dt)

    registration_url = row[7]
    if is_non_registration_url(registration_url):
        registration_url = None

    content_kind = row[9] or "other"
    content_kind = detect_content_kind(raw_text, parse_iso_datetime(start_at), content_kind == "digest", title=title)
    if content_kind == "recap":
        registration_url = None
    cover_image = row[10] or None
    if not cover_image:
        cover_image = pick_fallback_cover_image(title, content_kind)
    if not gallery:
        gallery = [cover_image] if cover_image else []

    return {
        "channel": row[0],
        "source_post_id": row[1],
        "source_post_url": row[2],
        "published_at": published_at,
        "title": title,
        "start_at": start_at,
        "location": row[6],
        "registration_url": registration_url,
        "raw_text": raw_text,
        "content_kind": content_kind,
        "cover_image": cover_image,
        "gallery": gallery,
    }


def event_signature(event: dict) -> str:
    return "|".join(
        [
            normalize_event_title(event.get("title") or "").lower(),
            event.get("start_at") or "",
            canonical_url(event.get("registration_url")) or "",
            str(event.get("source_post_id") or ""),
        ]
    )


def is_valid_archive_event(event: dict) -> bool:
    if is_probably_noise_title(event.get("title") or ""):
        return False
    content_kind = event.get("content_kind") or "other"
    title_lowered = (event.get("title") or "").lower()
    raw_lowered = (event.get("raw_text") or "").lower()
    if "дайджест" in title_lowered or "подборк" in title_lowered:
        return False
    if "обратный отсч" in title_lowered and not event.get("start_at"):
        return False
    if "до конца регистрации" in title_lowered:
        return False
    if title_lowered == "команда бизнес-клуба мгу" and not event.get("start_at"):
        return False
    if content_kind == "digest" and not event.get("registration_url"):
        return False
    if content_kind == "digest" and ("регистрация на события" in raw_lowered or "подборка событий" in raw_lowered) and not event.get("start_at"):
        return False
    if content_kind == "other" and not event.get("start_at") and not event.get("registration_url"):
        return False
    return True


def archive_sort_key(event: dict) -> Tuple[float, float]:
    start_dt = parse_iso_datetime(event.get("start_at"))
    published_dt = parse_iso_datetime(event.get("published_at"))
    primary = start_dt or published_dt
    secondary = published_dt or start_dt
    return (
        primary.timestamp() if primary else 0,
        secondary.timestamp() if secondary else 0,
    )


def load_export_events(conn: sqlite3.Connection, channel: str) -> List[dict]:
    rows = conn.execute(
        """
        SELECT
            channel,
            source_post_id,
            source_post_url,
            published_at,
            title,
            start_at,
            location,
            registration_url,
            raw_text,
            COALESCE(content_kind, 'other'),
            cover_image,
            gallery_json
        FROM events
        WHERE channel=?
        ORDER BY COALESCE(start_at, ''), COALESCE(published_at, ''), source_post_id
        """,
        (channel,),
    ).fetchall()

    events: List[dict] = []
    seen = set()
    for row in rows:
        event = sanitize_event_row(row)
        signature = event_signature(event)
        if signature in seen or not is_valid_archive_event(event):
            continue
        seen.add(signature)
        events.append(event)

    events.sort(key=archive_sort_key, reverse=True)
    return events


def backfill_event_media_cache(
    conn: sqlite3.Connection,
    channel: str,
    session: Optional[Any],
    media_cache_dir: str,
    media_url_prefix: str,
) -> int:
    rows = conn.execute(
        """
        SELECT
            event_key,
            channel,
            source_post_id,
            title,
            COALESCE(content_kind, 'other'),
            cover_image,
            gallery_json
        FROM events
        WHERE channel=?
        ORDER BY source_post_id DESC, event_key
        """,
        (channel,),
    ).fetchall()

    updated = 0
    with conn:
        for row in rows:
            gallery_raw = row[6]
            try:
                gallery = json.loads(gallery_raw) if gallery_raw else []
            except json.JSONDecodeError:
                gallery = []

            event = {
                "channel": row[1],
                "source_post_id": row[2],
                "title": row[3],
                "content_kind": row[4] or "other",
                "cover_image": row[5],
                "gallery": gallery,
            }
            if not localize_event_dict_media(event, session, media_cache_dir, media_url_prefix):
                continue

            conn.execute(
                """
                UPDATE events
                SET cover_image=?, gallery_json=?, updated_at=?
                WHERE event_key=?
                """,
                (
                    event["cover_image"],
                    json.dumps(event["gallery"], ensure_ascii=False),
                    now_iso(),
                    row[0],
                ),
            )
            updated += 1
    return updated


def is_home_candidate(event: dict, now_dt: datetime) -> bool:
    if event.get("content_kind") != "announcement":
        return False

    start_dt = parse_iso_datetime(event.get("start_at"))
    if not start_dt or start_dt < (now_dt - timedelta(days=45)):
        return False

    registration_url = event.get("registration_url")
    if not registration_url or is_non_registration_url(registration_url):
        return False

    published_dt = parse_iso_datetime(event.get("published_at"))
    if published_dt:
        delta = start_dt - published_dt
        if delta < timedelta(days=-2):
            return False
        if delta > timedelta(days=MAX_HOME_DELTA_DAYS):
            return False

    return True


def build_home_announcements(events: List[dict], limit: int) -> List[dict]:
    now_dt = datetime.now(tz=MOSCOW_TZ)
    candidates = [event for event in events if is_home_candidate(event, now_dt)]

    filtered: List[dict] = []
    seen = set()
    for event in candidates:
        signature = "|".join(
            [
                normalize_event_title(event.get("title") or "").lower(),
                event.get("start_at") or "",
                canonical_url(event.get("registration_url")) or "",
            ]
        )
        if signature in seen:
            continue
        seen.add(signature)
        filtered.append(event)

    def home_sort_key(event: dict) -> Tuple[int, float, float]:
        start_dt = parse_iso_datetime(event.get("start_at"))
        published_dt = parse_iso_datetime(event.get("published_at"))
        if not start_dt:
            return (2, float("inf"), 0)
        if start_dt >= now_dt:
            return (0, start_dt.timestamp(), -1 * (published_dt.timestamp() if published_dt else 0))
        return (1, -1 * start_dt.timestamp(), -1 * (published_dt.timestamp() if published_dt else 0))

    filtered.sort(key=home_sort_key)
    return filtered[:limit]


def export_events_json(conn: sqlite3.Connection, channel: str, out_path: str) -> int:
    events = load_export_events(conn, channel)
    payload = {
        "channel": channel,
        "events_count": len(events),
        "generated_at": now_iso(),
        "events": events,
    }
    atomic_write_json(out_path, payload)
    return len(events)


def export_home_json(conn: sqlite3.Connection, channel: str, out_path: str, limit: int) -> int:
    items = build_home_announcements(load_export_events(conn, channel), limit)
    payload = {
        "channel": channel,
        "items_count": len(items),
        "generated_at": now_iso(),
        "items": items,
    }
    atomic_write_json(out_path, payload)
    return len(items)


def export_outputs(
    conn: sqlite3.Connection,
    channel: str,
    export_path: Optional[str],
    home_export_path: Optional[str],
    home_limit: int,
    session: Optional[Any] = None,
    media_cache_dir: str = DEFAULT_MEDIA_CACHE_DIR,
    media_url_prefix: str = DEFAULT_MEDIA_URL_PREFIX,
) -> None:
    updated_media = backfill_event_media_cache(
        conn=conn,
        channel=channel,
        session=session,
        media_cache_dir=media_cache_dir,
        media_url_prefix=media_url_prefix,
    )
    if updated_media:
        logging.info("Localized media for %d event records", updated_media)
    if export_path:
        logging.info("Exported %d archive items -> %s", export_events_json(conn, channel, export_path), export_path)
    if home_export_path:
        logging.info("Exported %d homepage items -> %s", export_home_json(conn, channel, home_export_path, home_limit), home_export_path)


def make_session() -> Any:
    requests = require_requests()
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; tg-events-parser/3.0; +https://t.me)",
            "Accept-Language": "ru,en;q=0.8",
        }
    )
    return session


def get_with_retries(
    session: Any,
    url: str,
    timeout: int = 30,
    max_tries: int = 6,
    base_sleep: float = 1.0,
    max_sleep: float = 60.0,
) -> Any:
    requests = require_requests()
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_tries + 1):
        try:
            response = session.get(url, timeout=timeout)
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    sleep_s = min(max_sleep, max(base_sleep, float(retry_after)))
                else:
                    sleep_s = min(max_sleep, base_sleep * (2 ** (attempt - 1)))
                sleep_s *= 0.85 + random.random() * 0.4
                logging.warning("429 Too Many Requests: sleep %.1fs url=%s", sleep_s, url)
                time.sleep(sleep_s)
                continue

            if 500 <= response.status_code < 600:
                sleep_s = min(max_sleep, base_sleep * (2 ** (attempt - 1)))
                sleep_s *= 0.85 + random.random() * 0.4
                logging.warning("HTTP %s: retry in %.1fs url=%s", response.status_code, sleep_s, url)
                time.sleep(sleep_s)
                continue

            response.raise_for_status()
            return response
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            sleep_s = min(max_sleep, base_sleep * (2 ** (attempt - 1)))
            sleep_s *= 0.85 + random.random() * 0.4
            logging.warning("Network error: %s | retry in %.1fs url=%s", exc, sleep_s, url)
            time.sleep(sleep_s)
        except requests.HTTPError as exc:
            last_exc = exc
            raise

    raise RuntimeError(f"Failed after {max_tries} tries: {url}") from last_exc


def fetch_feed_page(session: Any, channel: str, before: Optional[int]) -> str:
    url = f"https://t.me/s/{channel}" if before is None else f"https://t.me/s/{channel}?before={before}"
    return get_with_retries(session, url=url).text


def fetch_single_post(session: Any, channel: str, post_id: int) -> str:
    return get_with_retries(session, url=f"https://t.me/s/{channel}/{post_id}").text


def append_jsonl(path: str, obj: dict) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(obj, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def process_post(
    conn: sqlite3.Connection,
    post: TelegramPost,
    events_jsonl: Optional[str],
    session: Optional[Any],
    media_cache_dir: str,
    media_url_prefix: str,
) -> Tuple[bool, int]:
    changed = db_upsert_post(conn, post)
    events = extract_events_from_post(post) if is_eventish_post(post.text) else []
    for event in events:
        localize_event_media(
            event=event,
            session=session,
            media_cache_dir=media_cache_dir,
            media_url_prefix=media_url_prefix,
        )
    event_count = db_replace_events_for_post(conn, post, events)

    if events_jsonl:
        for event in events:
            append_jsonl(
                events_jsonl,
                {
                    "channel": event.channel,
                    "source_post_id": event.source_post_id,
                    "source_post_url": event.source_post_url,
                    "published_at": event.published_at,
                    "title": event.title,
                    "start_at": event.start_at,
                    "location": event.location,
                    "registration_url": event.registration_url,
                    "raw_text": event.raw_text,
                    "content_kind": event.content_kind,
                    "cover_image": event.cover_image,
                    "gallery": event.gallery,
                },
            )

    return changed, event_count


def run_update_mode(
    conn: sqlite3.Connection,
    channel: str,
    max_pages: int,
    max_posts: int,
    stop_after_known: int,
    sleep_sec: float,
    checkpoint_every: int,
    export_path: Optional[str],
    home_export_path: Optional[str],
    home_limit: int,
    checkpoint_path: Optional[str],
    events_jsonl: Optional[str],
    media_cache_dir: str,
    media_url_prefix: str,
) -> None:
    session = make_session()
    before = None
    pages = 0
    processed_posts = 0
    upserted_posts = 0
    upserted_events = 0
    known_streak = 0

    def write_checkpoint(status: str = "ok", **extra: Any) -> None:
        if not checkpoint_path:
            return

        payload = {
            "channel": channel,
            "mode": "update",
            "status": status,
            "before": before,
            "pages": pages,
            "processed_posts": processed_posts,
            "upserted_posts": upserted_posts,
            "upserted_events": upserted_events,
            "known_streak": known_streak,
            "updated_at": now_iso(),
        }
        payload.update(extra)
        atomic_write_json(checkpoint_path, payload)

    def do_checkpoint(export: bool = True, status: str = "ok", **extra: Any) -> None:
        write_checkpoint(status=status, **extra)
        if not export:
            return
        export_outputs(
            conn,
            channel,
            export_path,
            home_export_path,
            home_limit,
            session=session,
            media_cache_dir=media_cache_dir,
            media_url_prefix=media_url_prefix,
        )

    while pages < max_pages and processed_posts < max_posts:
        try:
            html = fetch_feed_page(session, channel, before=before)
        except Exception as exc:
            logging.exception("Failed to fetch feed page (before=%s): %s", before, exc)
            if pages == 0 and processed_posts == 0:
                logging.error("Update aborted before the first page was processed. Keeping previous exports unchanged.")
                do_checkpoint(
                    export=False,
                    status="error",
                    reason="fetch_failed_before_first_page",
                    error=str(exc)[:300],
                )
            else:
                do_checkpoint(
                    status="partial",
                    reason="fetch_failed_after_partial_update",
                    error=str(exc)[:300],
                )
            return

        posts = parse_posts_from_html(html, channel)
        if not posts:
            if before is None and pages == 0 and processed_posts == 0:
                logging.error("No posts were parsed from the first feed page. Keeping previous exports unchanged.")
                do_checkpoint(
                    export=False,
                    status="error",
                    reason="no_posts_on_first_page",
                )
            else:
                logging.info("No posts found on page, stopping.")
                do_checkpoint()
            return

        pages += 1
        existing = db_existing_post_ids(conn, channel, [post.post_id for post in posts])

        for post in posts:
            if processed_posts >= max_posts:
                break

            processed_posts += 1
            known_streak = known_streak + 1 if post.post_id in existing else 0

            try:
                changed, event_count = process_post(
                    conn,
                    post,
                    events_jsonl,
                    session=session,
                    media_cache_dir=media_cache_dir,
                    media_url_prefix=media_url_prefix,
                )
                if changed:
                    upserted_posts += 1
                upserted_events += event_count
            except Exception as exc:
                logging.exception("Error processing post %s: %s", post.post_url, exc)

            if checkpoint_every > 0 and (processed_posts % checkpoint_every == 0):
                do_checkpoint()

            if known_streak >= stop_after_known:
                logging.info("Stop condition reached: %d known posts in a row.", known_streak)
                do_checkpoint()
                return

        min_post_id = min(post.post_id for post in posts)
        if before == min_post_id:
            logging.info("Pagination stuck (before repeats), stopping.")
            do_checkpoint()
            return
        before = min_post_id
        time.sleep(sleep_sec)

    do_checkpoint()


def run_fetch_ids_mode(
    conn: sqlite3.Connection,
    channel: str,
    ids: List[int],
    sleep_sec: float,
    export_path: Optional[str],
    home_export_path: Optional[str],
    home_limit: int,
    events_jsonl: Optional[str],
    media_cache_dir: str,
    media_url_prefix: str,
) -> None:
    requests = require_requests()
    session = make_session()

    for index, post_id in enumerate(ids, start=1):
        try:
            html = fetch_single_post(session, channel, post_id)
            posts = parse_posts_from_html(html, channel)
            post = next((item for item in posts if item.post_id == post_id), None)
            if not post:
                db_mark_missing(conn, channel, post_id, status="not_found", note="No tgme_widget_message for this id")
                logging.warning("post_id=%d not parsed (maybe deleted)", post_id)
                continue

            process_post(
                conn,
                post,
                events_jsonl,
                session=session,
                media_cache_dir=media_cache_dir,
                media_url_prefix=media_url_prefix,
            )
            logging.info("[%d/%d] OK post_id=%d", index, len(ids), post_id)
        except requests.HTTPError as exc:
            status_code = getattr(exc.response, "status_code", None)
            if status_code == 404:
                db_mark_missing(conn, channel, post_id, status="not_found", note="HTTP 404")
            elif status_code == 403:
                db_mark_missing(conn, channel, post_id, status="forbidden", note="HTTP 403")
            else:
                db_mark_missing(conn, channel, post_id, status="http_error", note=f"HTTP {status_code}")
            logging.warning("post_id=%d HTTP error: %s", post_id, exc)
        except Exception as exc:
            db_mark_missing(conn, channel, post_id, status="error", note=str(exc)[:200])
            logging.exception("post_id=%d failed: %s", post_id, exc)

        time.sleep(sleep_sec)

    export_outputs(
        conn,
        channel,
        export_path,
        home_export_path,
        home_limit,
        session=session,
        media_cache_dir=media_cache_dir,
        media_url_prefix=media_url_prefix,
    )


def run_repair_missing_mode(
    conn: sqlite3.Connection,
    channel: str,
    limit: int,
    sleep_sec: float,
    export_path: Optional[str],
    home_export_path: Optional[str],
    home_limit: int,
    events_jsonl: Optional[str],
    media_cache_dir: str,
    media_url_prefix: str,
) -> None:
    min_post_id, max_post_id = db_min_max_post_id(conn, channel)
    if min_post_id is None or max_post_id is None:
        logging.warning("DB has no posts yet, repair_missing makes no sense. Run update first.")
        return

    missing = db_missing_ids_in_range(conn, channel, start_id=min_post_id, end_id=max_post_id, limit=limit)
    if not missing:
        logging.info("No missing ids detected in [%d..%d]", min_post_id, max_post_id)
        return

    logging.info("Repair missing: will fetch %d ids in range [%d..%d]", len(missing), min_post_id, max_post_id)
    run_fetch_ids_mode(
        conn,
        channel,
        missing,
        sleep_sec=sleep_sec,
        export_path=export_path,
        home_export_path=home_export_path,
        home_limit=home_limit,
        events_jsonl=events_jsonl,
        media_cache_dir=media_cache_dir,
        media_url_prefix=media_url_prefix,
    )


def parse_ids_list(value: str) -> List[int]:
    items: List[int] = []
    for part in value.split(","):
        candidate = clean_text(part)
        if not candidate:
            continue
        items.append(int(candidate))
    seen = set()
    unique: List[int] = []
    for item in items:
        if item in seen:
            continue
        unique.append(item)
        seen.add(item)
    return unique


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Telegram public channel events parser with SQLite progress and filtered exports."
    )
    parser.add_argument("--channel", default="bcmsu", help="username канала без @")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="SQLite файл прогресса")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    parser.add_argument("--sleep", type=float, default=1.4, help="пауза между запросами")
    parser.add_argument("--max-pages", type=int, default=12, help="лимит страниц ленты")
    parser.add_argument("--max-posts", type=int, default=250, help="лимит постов за запуск")
    parser.add_argument("--stop-after-known", type=int, default=25, help="остановиться после N известных постов подряд")
    parser.add_argument("--export", default=DEFAULT_EXPORT_PATH, help="куда экспортировать архивный JSON")
    parser.add_argument("--home-export", default=DEFAULT_HOME_EXPORT_PATH, help="куда экспортировать JSON для главной")
    parser.add_argument("--home-limit", type=int, default=4, help="сколько автокарточек делать для главной")
    parser.add_argument("--checkpoint-file", default=DEFAULT_CHECKPOINT_PATH, help="файл прогресса")
    parser.add_argument("--checkpoint-every", type=int, default=40, help="чекпоинт каждые N обработанных постов")
    parser.add_argument("--events-jsonl", default=None, help="если задано, писать события построчно в JSONL")
    parser.add_argument("--media-cache-dir", default=DEFAULT_MEDIA_CACHE_DIR, help="куда складывать локальные копии картинок")
    parser.add_argument("--media-url-prefix", default=DEFAULT_MEDIA_URL_PREFIX, help="какой web-путь писать в JSON для скачанных картинок")
    parser.add_argument("--fetch-ids", default=None, help="скачать только эти id: 123,124,130")
    parser.add_argument("--repair-missing", action="store_true", help="добрать пропущенные id")
    parser.add_argument("--repair-limit", type=int, default=120, help="сколько id максимум добирать за запуск")
    parser.add_argument("--export-only", action="store_true", help="не ходить в сеть, только собрать экспорты из SQLite")

    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s | %(levelname)s | %(message)s",
    )

    conn = db_connect(args.db)
    db_init(conn)

    try:
        if args.export_only:
            export_outputs(
                conn,
                args.channel,
                args.export,
                args.home_export,
                args.home_limit,
                media_cache_dir=args.media_cache_dir,
                media_url_prefix=args.media_url_prefix,
            )
            return

        if args.fetch_ids:
            run_fetch_ids_mode(
                conn,
                args.channel,
                parse_ids_list(args.fetch_ids),
                sleep_sec=args.sleep,
                export_path=args.export,
                home_export_path=args.home_export,
                home_limit=args.home_limit,
                events_jsonl=args.events_jsonl,
                media_cache_dir=args.media_cache_dir,
                media_url_prefix=args.media_url_prefix,
            )
            return

        if args.repair_missing:
            run_repair_missing_mode(
                conn,
                args.channel,
                limit=args.repair_limit,
                sleep_sec=args.sleep,
                export_path=args.export,
                home_export_path=args.home_export,
                home_limit=args.home_limit,
                events_jsonl=args.events_jsonl,
                media_cache_dir=args.media_cache_dir,
                media_url_prefix=args.media_url_prefix,
            )
            return

        run_update_mode(
            conn=conn,
            channel=args.channel,
            max_pages=args.max_pages,
            max_posts=args.max_posts,
            stop_after_known=args.stop_after_known,
            sleep_sec=args.sleep,
            checkpoint_every=args.checkpoint_every,
            export_path=args.export,
            home_export_path=args.home_export,
            home_limit=args.home_limit,
            checkpoint_path=args.checkpoint_file,
            events_jsonl=args.events_jsonl,
            media_cache_dir=args.media_cache_dir,
            media_url_prefix=args.media_url_prefix,
        )
    except MissingDependencyError as exc:
        logging.error("%s", exc)
        sys.exit(2)
    except KeyboardInterrupt:
        logging.warning("Interrupted by user. Exporting current state...")
        export_outputs(
            conn,
            args.channel,
            args.export,
            args.home_export,
            args.home_limit,
            media_cache_dir=args.media_cache_dir,
            media_url_prefix=args.media_url_prefix,
        )
        if args.checkpoint_file:
            atomic_write_json(args.checkpoint_file, {"channel": args.channel, "interrupted_at": now_iso()})
        sys.exit(0)
    except Exception as exc:
        logging.exception("Fatal error: %s", exc)
        export_outputs(
            conn,
            args.channel,
            args.export,
            args.home_export,
            args.home_limit,
            media_cache_dir=args.media_cache_dir,
            media_url_prefix=args.media_url_prefix,
        )
        if args.checkpoint_file:
            atomic_write_json(args.checkpoint_file, {"channel": args.channel, "fatal_at": now_iso(), "error": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()
