# Бизнес-клуб МГУ - миграция на Next.js

## Что осталось неизменным

- Весь визуал и разметка
- Общие стили и скрипты
- Архив мероприятий из `public/assets/data/events.json`
- Автолента анонсов на главной из `public/assets/data/home-announcements.json`

## Запуск

```bash
npm install
npm run dev
```

Открыть: `http://localhost:3000/`

## Telegram-парсер

Установить Python-зависимости:

```bash
pip install -r requirements.txt
```

Обновить SQLite и сразу собрать публичные JSON:

```bash
python tools/parser.py --channel bcmsu --db tools/tg_events.sqlite --export public/assets/data/events.json --home-export public/assets/data/home-announcements.json
```

Собрать только экспорты из уже существующей SQLite-базы, без сети:

```bash
python tools/parser.py --channel bcmsu --db tools/tg_events.sqlite --export public/assets/data/events.json --home-export public/assets/data/home-announcements.json --export-only
```
