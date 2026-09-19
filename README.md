# Workflow Tracking API

Express + Sequelize REST API using a controller → service → repository architecture.

## Stack

- **Express** — HTTP layer
- **Sequelize** (PostgreSQL) — ORM
- **Joi** — DTO validation/shaping (`src/dtos`)
- **jsonwebtoken** + **bcryptjs** — auth: JWT access tokens, password hashing
- **cookie-parser** — reads the httpOnly auth cookies
- **Winston** — logging (console in dev, `logs/combined.log` + `logs/error.log` always)
- **swagger-jsdoc** + **swagger-ui-express** — API docs at `/api-docs`
- **nodemon** — dev auto-reload
- **Jest** + **Supertest** — integration tests against a real Postgres test database (see [Testing](#testing))
- **ESLint** — `eslint:recommended`, flat config (`eslint.config.js`)
- **Husky** — local git hooks (pre-commit lint, pre-push tests)

## Setup

```bash
npm install
cp .env.example .env   # then edit DB credentials and JWT secret
npm run migrate        # create tables
npm run seed           # seed roles (ADMIN, EMPLOYEE) and lookup values (USER_STATUS)
npm run dev            # start with nodemon
```

Docs: http://localhost:3000/api-docs
Health check: http://localhost:3000/api/v1/health

## Architecture

```
src/
  config/       env, sequelize, winston, swagger config
  constants/    shared enum-like string constants (role names, lookup types/values, token/session status)
  models/       Sequelize models
  database/     migrations & seeders
  dtos/         Joi request schemas + response shaping classes
  repositories/ data access only (talks to Sequelize models)
  services/     business logic (talks to repositories)
  controllers/  HTTP req/res handling (talks to services)
  routes/       Express routers + swagger-jsdoc annotations
  middlewares/  authentication, validation, error handling, request logging
```

Request flow: `route -> validate(DTO) -> controller -> service -> repository -> model`.

## Authentication

JWT access token + opaque random refresh token, both delivered as httpOnly cookies (never in the JSON body):

| Endpoint | Method | Auth required | Notes |
|---|---|---|---|
| `/api/v1/auth/signup` | POST | No | Creates a user with the `EMPLOYEE` role and `ACTIVE` status by default, opens a session |
| `/api/v1/auth/signin` | POST | No | Rejects inactive accounts (403), opens a session |
| `/api/v1/auth/refresh-token` | POST | Refresh cookie | Rotates the refresh token (single-use); reuse of an already-rotated token revokes the whole session |
| `/api/v1/auth/logout` | POST | Refresh cookie (optional) | Revokes the current session and clears both cookies |
| `/api/v1/auth/me` | GET | Access cookie | Example of a route protected by `authenticate.middleware.js` |

The access token cookie is scoped to `/`, the refresh token cookie to `/api/v1/auth`. See `src/utils/cookies.js`.

### Session model

Sign-in/sign-up creates a **session** (one per device/browser), capped at `MAX_ACTIVE_SESSIONS_PER_USER` (default 3) — the least-recently-used session is evicted when a new login would exceed the cap. Each session owns one **token family**, which tracks the rotation history of its refresh tokens:

- Refresh tokens are single-use: each `/auth/refresh-token` call invalidates the presented token and issues a new one in the same family.
- Presenting a token that's already been rotated away (or revoked) is treated as theft (**reuse detection**) and immediately revokes the entire family + session, forcing re-authentication.
- `authenticate.middleware.js` checks the session's status on every request (not just at refresh time), so a revoked session stops working immediately rather than waiting for the access token to expire on its own.

See [DECISIONS.md](DECISIONS.md) (Q19–Q28) for the full design rationale, including three concurrency bugs found and fixed while building/testing this (`FOR UPDATE` + outer joins, a transaction-rollback footgun in the reuse-detection path, and a phantom-read race in session-limit enforcement), plus the known tradeoff of strict rotation with concurrent requests.

## Testing

```bash
npm test
```

Integration tests (Jest + Supertest) run against a real, dedicated `<DB_NAME>_test` Postgres database - not mocks - since the properties under test (transaction behavior, row locking, reuse detection, concurrency) only mean something against a real database. `jest.config.js`'s `globalSetup`/`globalTeardown` create that database and run the actual migrations/seeders once per run; each test file truncates the mutable tables between tests. Tests run serially (`--runInBand`) since they share one database.

Coverage: signup/signin (incl. validation, duplicate email, inactive account, wrong password), `/me` and `authenticate.middleware.js` (missing/malformed/expired/forged tokens, Bearer header, immediate revocation on logout), refresh-token rotation, reuse detection (including that it revokes the *whole* session, not just the replayed token), expiration, logout, and the 3-session cap under both sequential and concurrent logins. See [DECISIONS.md](DECISIONS.md) Q27–Q28.

## CI & merge gate

```bash
npm run lint       # ESLint
npm run lint:fix   # ESLint, auto-fixing what it can
```

Every PR into `main` runs `.github/workflows/ci.yml`: install → lint → test, against a real `postgres:16` service container (same reasoning as local testing above). Locally, Husky hooks catch problems even earlier: `pre-commit` runs lint, `pre-push` runs the test suite. Hooks are a convenience, not the enforcement - the actual gate is the required GitHub Actions check on `main`.

**One-time setup** (repo admin, in GitHub, not in code): Settings → Branches → Add branch protection rule for `main` → enable "Require a pull request before merging" and "Require status checks to pass before merging" → select the `lint-and-test` check.

See [DECISIONS.md](DECISIONS.md) Q29–Q32 for the reasoning, including why there's no separate "build" step.

## Database schema

- **`lookup`** — generic type/value table for enum-like data (currently `USER_STATUS`: `ACTIVE`/`INACTIVE`)
- **`roles`** — `ADMIN`, `EMPLOYEE`
- **`users`** — profile + credentials; `status` is a FK to `lookup.id`
- **`user_roles`** — many-to-many join between `users` and `roles`
- **`sessions`** — one row per logged-in device; capped per user, checked on every authenticated request
- **`token_families`** — one row per session's refresh-token rotation lineage; `ACTIVE` / `REVOKED` / `COMPROMISED`
- **`refresh_tokens`** — one row per issued (hashed) refresh token; `replaced_by_id` forms the rotation history chain

Run `npm run seed` after `npm run migrate` on a fresh database - signup fails with a 500 until the `ACTIVE` lookup row and `EMPLOYEE` role exist.

See [DECISIONS.md](DECISIONS.md) for the reasoning behind these choices.
