# Бизнес-клуб МГУ - миграция на Next.js

## Что осталось неизменным

- Весь визуал и разметка
- Общие стили и скрипты
- Архив мероприятий из `public/assets/data/events.json`
- Блок анонсов на главной автоматически собирается из `public/assets/data/events.json`

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
python tools/parser.py --channel bcmsu --db tools/tg_events.sqlite
```

По умолчанию парсер теперь обновляет `public/assets/data/events.json`, `public/assets/data/home-announcements.json` и кэширует изображения постов в `public/assets/img/parser`.

Собрать только экспорты из уже существующей SQLite-базы, без сети:

```bash
python tools/parser.py --channel bcmsu --db tools/tg_events.sqlite --export-only
```
