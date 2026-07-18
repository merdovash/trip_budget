# Семейный бюджет

Веб-приложение для планирования семейного бюджета при переезде в другую страну.

## Возможности

- Периодические доходы и расходы (ежемесячно, ежегодно, еженедельно)
- Разовые крупные траты с указанием даты
- Выбор страны и налогового режима (10 стран, 14 режимов)
- Помесячный прогноз cash flow с учётом налогов
- График доходов, расходов и накопленного баланса
- Рабочий бюджет в localStorage; сохранённые наборы (пресеты) в PostgreSQL
- Регистрация / вход по email и паролю; публичные и персональные пресеты

## Поддерживаемые страны

Испания, Таиланд, Малайзия, Португалия, ОАЭ, Грузия, Кипр, Мексика, Индонезия, Вьетнам, Россия.

## Требования

- Node.js 20+
- npm 10+
- PostgreSQL 16+ (локально удобно через Docker Compose)

## Запуск

1. Скопируйте `.env.example` в `.env` (шаблон `DATABASE_URL`).
2. Поднимите БД.

**С Docker (локально):**

```bash
npm install
npm run db:up
npm run db:migrate
npm run db:seed
```

**Без Docker (удалённый сервер / системный PostgreSQL):**

```bash
npm install
# В .env задайте DATABASE_URL и PG_ADMIN_URL (суперпользователь для CREATE ROLE/DB)
# Пример: PG_ADMIN_URL=postgresql://postgres:SECRET@localhost:5432/postgres
npm run db:setup
```

`db:setup` = создать роль/БД (`db:bootstrap`) + миграции + сид.  
Альтернатива вручную через psql: `server/db/sql/00_bootstrap.sql`, затем `npm run db:migrate && npm run db:seed`.  
Скрипт-обёртка: `scripts/db-setup.sh`.

Ошибки API пишутся в `logs/server-error.log` (папка создаётся автоматически).

3. Приложение:

```bash
npm run dev
```

Откройте http://localhost:5173

С других устройств в той же локальной сети — по адресу `http://<IP-вашего-ПК>:5173`
(Vite выводит Network URL при запуске `npm run dev`).

## Сборка и тесты

```bash
npm run build
npm run test
```

## Деплой на REG.RU (GitHub Actions)

По push в `main` (или вручную через Actions → Deploy to REG.RU) собирается `dist` и заливается по FTP.

В репозитории: **Settings → Secrets and variables → Actions** добавьте:

| Secret | Пример |
|--------|--------|
| `FTP_HOST` | `server276.hosting.reg.ru` (хост из панели FTP) |
| `FTP_USER` | логин FTP |
| `FTP_PASSWORD` | пароль FTP |
| `FTP_SERVER_DIR` | `./public_html/` или `./www/ваш-домен.ru/` |
| `FTP_PROTOCOL` | опционально: `ftp` (по умолчанию) или `ftps` |

На shared-хостинге работают только статика и localStorage; API (`/api/...`) без Node на сервере недоступен.

## Ограничения

Расчёты носят ознакомительный характер и не являются налоговой консультацией. Налоговые модули упрощены и предназначены для сравнительного планирования.

## Структура

- `src/types/` — типы данных
- `src/store/` — Zustand store с persist
- `src/tax/` — налоговый движок (расширяемый)
- `src/engine/` — расчёт бюджета
- `src/components/` — UI-компоненты
- `server/` — API auth/presets, доступ к PostgreSQL
- `server/db/migrations/` — SQL-миграции
