#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup


MOSCOW_TZ = ZoneInfo("Europe/Moscow")

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

EVENT_HINT_HASHTAGS = ("#анонс", "#ивенты", "#дайджест")
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
    "ивент",
    "событ",
)


@dataclass
class TelegramPost:
    channel: str
    post_id: int
    post_url: str
    published_at: Optional[datetime]
    text: str
    links: List[str]


@dataclass
class Event:
    channel: str
    source_post_id: int
    source_post_url: str
    published_at: Optional[str]  # iso
    title: str
    start_at: Optional[str]      # iso
    location: Optional[str]
    registration_url: Optional[str]
    raw_text: str


def _clean_text(s: str) -> str:
    s = re.sub(r"\u00a0", " ", s)  # NBSP
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def fetch_channel_page_html(session: requests.Session, channel: str, before: Optional[int] = None) -> str:
    base = f"https://t.me/s/{channel}"
    url = base if before is None else f"{base}?before={before}"
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_posts_from_html(html: str, channel: str) -> List[TelegramPost]:
    soup = BeautifulSoup(html, "html.parser")
    posts: List[TelegramPost] = []

    # Каждое сообщение обычно обёрнуто в div.tgme_widget_message_wrap
    for wrap in soup.select("div.tgme_widget_message_wrap"):
        date_a = wrap.select_one("a.tgme_widget_message_date")
        if not date_a or not date_a.get("href"):
            continue

        post_url = date_a["href"].strip()
        try:
            post_id = int(post_url.rstrip("/").split("/")[-1])
        except Exception:
            continue

        published_at = None
        time_tag = date_a.select_one("time")
        if time_tag and time_tag.get("datetime"):
            # Telegram обычно отдаёт ISO8601, например 2025-12-09T19:30:00+03:00
            dt_raw = time_tag["datetime"].replace("Z", "+00:00")
            try:
                published_at = datetime.fromisoformat(dt_raw)
            except Exception:
                published_at = None

        text_div = wrap.select_one("div.tgme_widget_message_text")
        text = ""
        if text_div:
            text = text_div.get_text("\n")
        text = _clean_text(text)

        links: List[str] = []
        if text_div:
            for a in text_div.select("a[href]"):
                href = a.get("href", "").strip()
                if href:
                    links.append(href)
        # de-dup, preserve order
        seen = set()
        uniq_links = []
        for l in links:
            if l not in seen:
                uniq_links.append(l)
                seen.add(l)

        posts.append(
            TelegramPost(
                channel=channel,
                post_id=post_id,
                post_url=post_url,
                published_at=published_at,
                text=text,
                links=uniq_links,
            )
        )

    # Обычно на странице они идут сверху вниз (новые -> старые), но на всякий случай:
    posts.sort(key=lambda p: p.post_id, reverse=True)
    return posts


def is_eventish_post(text: str) -> bool:
    low = text.lower()
    if any(tag in low for tag in EVENT_HINT_HASHTAGS):
        return True
    if any(w in low for w in EVENT_HINT_WORDS):
        return True
    return False


def pick_title(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "Событие"
    # Часто первая строка — заголовок
    return lines[0][:200]


def pick_location(text: str) -> Optional[str]:
    # Ищем строку вида "Место: ...."
    for ln in text.splitlines():
        m = re.search(r"(?i)\bместо\b\s*[:\-]\s*(.+)$", ln.strip())
        if m:
            return m.group(1).strip()
    return None


def pick_registration_url(post: TelegramPost) -> Optional[str]:
    # Предпочитаем внешние ссылки (не t.me)
    for url in post.links:
        if "t.me/" in url or url.startswith("tg://"):
            continue
        return url
    return post.links[0] if post.links else None


def parse_ru_datetime_from_text(text: str, base: Optional[datetime]) -> Optional[datetime]:
    """
    Best-effort: выдёргиваем первую встреченную дату/время из текста.
    Поддерживает:
      - 09.12.2025 ... 18:30
      - 4 декабря, 18:00
    Если год не указан — берём base.year (или текущий год).
    """
    base = base or datetime.now(tz=MOSCOW_TZ)
    low = text.lower()

    # 1) dd.mm.yyyy
    m = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{2,4})", low)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
        hh, mm = 0, 0
        tm = re.search(r"(\d{1,2}):(\d{2})", low[m.end(): m.end() + 50])
        if tm:
            hh, mm = int(tm.group(1)), int(tm.group(2))
        dt = datetime(y, mo, d, hh, mm, tzinfo=MOSCOW_TZ)
        return dt

    # 2) dd.mm (без года)
    m = re.search(r"(\d{1,2})[./](\d{1,2})(?![./]\d)", low)
    if m:
        d, mo = int(m.group(1)), int(m.group(2))
        y = base.year
        hh, mm = 0, 0
        tm = re.search(r"(\d{1,2}):(\d{2})", low[m.end(): m.end() + 50])
        if tm:
            hh, mm = int(tm.group(1)), int(tm.group(2))
        if not mo:
            mo = 1
        candidate = datetime(y, mo, d, hh, mm, tzinfo=MOSCOW_TZ)
        # если дата “сильно в прошлом” относительно base — возможно, это следующий год
        if candidate < (base - timedelta(days=7)):
            candidate = datetime(y + 1, mo, d, hh, mm, tzinfo=MOSCOW_TZ)
        return candidate

    # 3) "4 декабря (2025) ... 18:00"
    m = re.search(
        r"(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?",
        low,
    )
    if m:
        d = int(m.group(1))
        mo = RU_MONTHS.get(m.group(2), 0)
        y = int(m.group(3)) if m.group(3) else base.year
        hh, mm = 0, 0
        tm = re.search(r"(\d{1,2}):(\d{2})", low[m.end(): m.end() + 60])
        if tm:
            hh, mm = int(tm.group(1)), int(tm.group(2))
        candidate = datetime(y, mo, d, hh, mm, tzinfo=MOSCOW_TZ)
        if not m.group(3) and candidate < (base - timedelta(days=7)):
            candidate = datetime(y + 1, mo, d, hh, mm, tzinfo=MOSCOW_TZ)
        return candidate

    return None


def extract_events_from_post(post: TelegramPost) -> List[Event]:
    """
    Возвращает 0..N событий.
    - Если пост похож на дайджест: события = внешние ссылки (название = "текст ссылки" в HTML мы тут не храним,
      поэтому берём строку с URL/или общий title; это компромисс).
    - Если пост похож на анонс: одно событие с вытащенными полями.
    """
    text = post.text or ""
    low = text.lower()

    # Дайджест: часто "Регистрация на события:" + список ссылок + #дайджест
    is_digest = ("регистрация на события" in low) and (len(post.links) >= 2) and ("#дайджест" in low)

    events: List[Event] = []
    if is_digest:
        # В дайджестах ссылки часто ведут на регистрацию; делаем событие на каждую внешнюю ссылку
        for url in post.links:
            if "t.me/" in url or url.startswith("tg://"):
                continue
            # Попытка вытащить "название" из строки, где встречается ссылка (best-effort)
            title = None
            for ln in text.splitlines():
                if url in ln:
                    title = ln.strip("—–-• \t").strip()
                    break
            if not title or title == url:
                title = "Событие из дайджеста"

            events.append(
                Event(
                    channel=post.channel,
                    source_post_id=post.post_id,
                    source_post_url=post.post_url,
                    published_at=post.published_at.isoformat() if post.published_at else None,
                    title=title[:200],
                    start_at=None,
                    location=None,
                    registration_url=url,
                    raw_text=text,
                )
            )
        return events

    # Иначе: одно “главное” событие из поста
    title = pick_title(text)
    location = pick_location(text)
    start_dt = parse_ru_datetime_from_text(text, post.published_at)
    reg_url = pick_registration_url(post)

    events.append(
        Event(
            channel=post.channel,
            source_post_id=post.post_id,
            source_post_url=post.post_url,
            published_at=post.published_at.isoformat() if post.published_at else None,
            title=title,
            start_at=start_dt.isoformat() if start_dt else None,
            location=location,
            registration_url=reg_url,
            raw_text=text,
        )
    )
    return events


def scrape_events(
    channel: str,
    max_posts: int,
    sleep_sec: float,
    stop_at_post_id: Optional[int] = None,
) -> Tuple[List[TelegramPost], List[Event]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; tg-events-parser/1.0; +https://t.me)",
            "Accept-Language": "ru,en;q=0.8",
        }
    )

    all_posts: List[TelegramPost] = []
    all_events: List[Event] = []
    seen_post_ids = set()

    before: Optional[int] = None

    while len(all_posts) < max_posts:
        html = fetch_channel_page_html(session, channel, before=before)
        posts = parse_posts_from_html(html, channel)

        if not posts:
            break

        # Отфильтровать новые (на всякий случай)
        new_posts = []
        for p in posts:
            if p.post_id in seen_post_ids:
                continue
            if stop_at_post_id is not None and p.post_id <= stop_at_post_id:
                continue
            new_posts.append(p)
            seen_post_ids.add(p.post_id)

        if not new_posts:
            break

        # Добавляем, но не превышаем max_posts
        space = max_posts - len(all_posts)
        new_posts = new_posts[:space]

        all_posts.extend(new_posts)

        # События
        for p in new_posts:
            if is_eventish_post(p.text):
                all_events.extend(extract_events_from_post(p))

        # Пагинация: уходим "раньше самого старого id на странице"
        min_id = min(p.post_id for p in posts)
        # Если before уже такой же — выходим (защита от зацикливания)
        if before == min_id:
            break
        before = min_id

        time.sleep(sleep_sec)

    # Сортируем для удобства
    all_posts.sort(key=lambda p: p.post_id, reverse=True)
    # События можно сортировать по start_at (если есть), иначе по published_at
    def _event_sort_key(e: Event):
        return (
            e.start_at or "",
            e.published_at or "",
            e.source_post_id,
        )

    all_events.sort(key=_event_sort_key)
    return all_posts, all_events


def main():
    ap = argparse.ArgumentParser(description="Парсер событий из публичного Telegram-канала (t.me/s/<channel>)")
    ap.add_argument("--channel", default="bcmsu", help="username канала без @ (по умолчанию: bcmsu)")
    ap.add_argument("--max-posts", type=int, default=80, help="сколько постов максимум скачать")
    ap.add_argument("--sleep", type=float, default=1.0, help="пауза между запросами (сек)")
    ap.add_argument("--stop-at-post-id", type=int, default=None, help="остановиться на post_id <= этому (для инкрементального режима)")
    ap.add_argument("--out", default="events.json", help="файл для сохранения событий (json)")
    args = ap.parse_args()

    posts, events = scrape_events(
        channel=args.channel,
        max_posts=args.max_posts,
        sleep_sec=args.sleep,
        stop_at_post_id=args.stop_at_post_id,
    )

    payload = {
        "channel": args.channel,
        "fetched_posts": len(posts),
        "events": [asdict(e) for e in events],
        "generated_at": datetime.now(tz=MOSCOW_TZ).isoformat(),
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"OK: posts={len(posts)} events={len(events)} -> {args.out}")


if __name__ == "__main__":
    main()