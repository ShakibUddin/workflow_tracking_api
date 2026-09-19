# Workflow Tracking API

Express + Sequelize REST API using a controller → service → repository architecture.

## Stack

- **Express** — HTTP layer
- **Sequelize** (PostgreSQL) — ORM
- **Joi** — DTO validation/shaping (`src/dtos`)
- **Winston** — logging (console in dev, `logs/combined.log` + `logs/error.log` always)
- **swagger-jsdoc** + **swagger-ui-express** — API docs at `/api-docs`
- **nodemon** — dev auto-reload
- **Jest** + **Supertest** — tests (see [Testing](#testing))
- **ESLint** — `eslint:recommended`, flat config (`eslint.config.js`)
- **Husky** — local git hooks (pre-commit lint, pre-push tests)

## Setup

```bash
npm install
cp .env.example .env   # then edit DB credentials
npm run migrate        # create tables
npm run dev            # start with nodemon
```

Docs: http://localhost:3000/api-docs
Health check: http://localhost:3000/api/v1/health

## Architecture

```
src/
  config/       env, sequelize, winston, swagger config
  models/       Sequelize models
  database/     migrations & seeders
  dtos/         Joi request schemas + response shaping classes
  repositories/ data access only (talks to Sequelize models)
  services/     business logic (talks to repositories)
  controllers/  HTTP req/res handling (talks to services)
  routes/       Express routers + swagger-jsdoc annotations
  middlewares/  validation, error handling, request logging
```

Request flow: `route -> validate(DTO) -> controller -> service -> repository -> model`.

This is bootstrap-only — no API resources are implemented yet. The layer folders exist (with `.gitkeep` placeholders) so new features can be added by dropping a model/migration/repository/service/controller/route into each, following the flow above.

## Testing

```bash
npm test
```

Jest + Supertest, hitting `src/app.js` in-process. Covers what currently exists: the health check, 404 handling, and the Swagger UI - none of it needs a database yet, since no route queries one. See [DECISIONS.md](DECISIONS.md) Q13 for when/why that'll need to change.

## CI & merge gate

```bash
npm run lint       # ESLint
npm run lint:fix   # ESLint, auto-fixing what it can
```

Every PR into `main` runs `.github/workflows/ci.yml`: install → lint → test. Locally, Husky hooks catch problems even earlier: `pre-commit` runs lint, `pre-push` runs the test suite. Hooks are a convenience, not the enforcement - the actual gate is the required GitHub Actions check on `main`.

**One-time setup** (repo admin, in GitHub, not in code): Settings → Branches → Add branch protection rule for `main` → enable "Require a pull request before merging" and "Require status checks to pass before merging" → select the `lint-and-test` check.

See [DECISIONS.md](DECISIONS.md) Q12–Q15 for the reasoning, including why there's no separate "build" step and why there's no Postgres service container in CI yet.
