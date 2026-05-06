# Family Budget

Self-hosted household budgeting app built with Next.js, TailwindCSS, PostgreSQL, and Docker Compose.

## Features

- Signup, household creation, and invite links for husband/wife shared household data.
- Dashboard cards for checking balance, monthly income, monthly bills, and safe-to-spend.
- Upcoming bill list, bill calendar, paid/unpaid status, recurring subscriptions, and auto-generated bill instances.
- Manual paycheck tracking with base, overtime, bonus, VA income, taxes, and deposits.
- Quick expense entry, category charts, spending trends, CSV import, and CSV export.
- Projection engine for end-of-month balance, committed bills, safe-to-spend, savings, and rollover.
- Savings goals, emergency fund tracking, snapshots, and bill notifications.
- Plaid-ready boundaries without implementing Plaid.

## Local Setup

1. Create an environment file:

```bash
cp .env.example .env
```

2. Start PostgreSQL. With Docker installed:

```bash
docker compose up postgres -d
```

3. Install dependencies and prepare the database:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The app runs at `http://localhost:3000`.

Optional demo seed logins, if `SEED_DEMO_DATA=true`:

- `husband@example.com` / `ChangeMe123!`
- `wife@example.com` / `ChangeMe123!`

For a live household, keep `SEED_DEMO_DATA=false` and create the first account at `/signup`.

## Full Docker

```bash
docker compose up --build
```

The Compose file creates a persistent `postgres_data` volume and runs migrations before the web server starts. Demo seeding only runs when `SEED_DEMO_DATA=true`.

## Going Live

Before exposing the app publicly:

- Set a strong `SESSION_SECRET`.
- Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to the public HTTPS origin, for example `https://budget.example.com`.
- Keep `SEED_DEMO_DATA=false` and `SHOW_DEMO_CREDENTIALS=false`.
- Change the default PostgreSQL password in `docker-compose.yml` or through environment overrides.
- Put the app behind HTTPS with your reverse proxy or hosting platform.
- Create the first household at `/signup`, then invite the second household user from Settings.

## Database

Migrations live in `db/migrations`. Core tables:

- `users`
- `accounts`
- `recurring_bills`
- `bill_instances`
- `income_entries`
- `expenses`
- `categories`
- `monthly_snapshots`
- `household_invites`

The schema also includes `households`, `savings_goals`, and `notifications` to support shared household ownership and nice extras cleanly.

## Plaid Later

Plaid is not implemented. The future integration points are:

- `src/lib/integrations/transactions/importer.ts`
- `src/lib/integrations/plaid/client.ts`
- `accounts.plaid_account_id`
- `expenses.external_source`
- `expenses.imported_transaction_id`
