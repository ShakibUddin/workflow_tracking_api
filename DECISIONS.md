# Decision Log

Running record of the choices made on this project, framed as Q&A, so future contributors know *why* something is the way it is and don't relitigate it without reason. Newest entries at the bottom.

---

### Q1: JavaScript or TypeScript?
**A:** Plain JavaScript.
Kept the stack simple with no build/compile step. If type safety becomes a pain point later, this can be revisited (e.g. incremental JSDoc types or a TS migration).

### Q2: What architecture pattern for the backend?
**A:** Controller → Service → Repository, layered explicitly as separate folders (`controllers/`, `services/`, `repositories/`).
Keeps HTTP concerns, business logic, and data access independent so each can be tested or swapped in isolation. Controllers never touch Sequelize models directly; only repositories do.

### Q3: How do we validate/shape request and response data (DTOs)?
**A:** Joi schemas for request validation (`src/dtos/*.dto.js`), plus plain DTO classes (e.g. `WorkflowResponseDto`) to shape outgoing responses.
JavaScript has no native decorators/type system to lean on (ruled out `class-validator`, which wants TypeScript-style decorators). Joi is pure JS, widely used, and keeps validation declarative. Response DTO classes decouple the API contract from the Sequelize model shape.

### Q4: Which ORM?
**A:** Sequelize.
Mature, works with multiple SQL dialects, has a CLI for migrations/seeders, and fits the layered repository pattern well.

### Q5: Which database?
**A:** PostgreSQL.
Uses the `pg` + `pg-hstore` drivers, with config defaults set to port `5432` and dialect `postgres`. Sequelize abstracts the dialect, so switching later stays low-cost if ever needed.

### Q6: How do we log?
**A:** Winston, with JSON file transports (`logs/combined.log`, `logs/error.log`) always on, plus a colorized console transport in non-production environments.
Structured JSON logs are easier to ship to log aggregators later; console output stays human-readable during development.

### Q7: How do we document the API?
**A:** `swagger-jsdoc` + `swagger-ui-express`, with OpenAPI annotations written inline as JSDoc comments in the route files, served at `/api-docs`.
Keeps the spec next to the code it describes instead of a separate hand-maintained file that drifts out of sync.

### Q8: How do we handle dev reload?
**A:** `nodemon`, configured via `nodemon.json` to watch `src/` for `.js`/`.json` changes.

### Q9: How are errors handled centrally?
**A:** A single `ApiError` class plus an Express error-handling middleware (`errorHandler.middleware.js`). Services/controllers throw `ApiError` (e.g. `ApiError.notFound(...)`), and the middleware maps it to the right HTTP status and logs at `warn` (4xx) or `error` (5xx).
Avoids scattering `res.status(...).json(...)` error-shaping logic across every controller.

### Q10: Why do empty folders (`logs/`, `src/database/seeders/`, `src/controllers/`, `src/services/`, `src/repositories/`, `src/dtos/`, `src/database/migrations/`) contain a `.gitkeep` file?
**A:** Because Git only tracks files, never directories - an empty folder isn't recorded in a commit at all, so it wouldn't exist after a fresh clone. A `.gitkeep` is not a real Git feature, just a convention: an empty placeholder file that forces Git to keep the otherwise-empty directory.
`logs/` is where Winston's file transports (`combined.log`, `error.log`) write on startup, and `sequelize-cli db:seed:all` expects `src/database/seeders/` to exist. The layer folders (`controllers/`, `services/`, `repositories/`, `dtos/`, `database/migrations/`) are currently empty because this repo is bootstrap-only (see Q11) - the `.gitkeep` files keep the intended architecture visible in the repo until real features fill them in.

### Q11: Do we ship a sample CRUD resource with the bootstrap?
**A:** No. An initial `Workflow` resource (model, migration, repository, service, controller, route, DTOs) was scaffolded to prove the architecture end-to-end, then removed once confirmed working.
This repo is meant to be a clean starting point, not a template with throwaway sample code that every real feature has to delete first. Only `src/routes/health.routes.js` remains as a working example of the route layer.

---

## CI / merge gate

### Q12: What runs before a PR can merge into `main`, and where is it defined?
**A:** A GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on every PR targeting `main` (and on direct pushes to `main`): install deps, `npm run lint` (ESLint), then `npm test` (Jest + Supertest). No separate "build" step - there's nothing to compile in a plain Node/Express app, so a clean `npm ci` + passing lint + passing tests *is* the build check.
Branch protection (requiring this workflow's check to pass, and requiring a PR before merging) is a GitHub *repository setting*, not something expressed in code - it has to be turned on once in GitHub's UI (Settings → Branches → branch protection rule for `main` → require the `lint-and-test` status check).

### Q13: Why does the test suite not need a Postgres service container in CI (yet)?
**A:** At this point in the codebase, nothing reachable from `src/app.js` touches the database - `routes/index.js` only mounts the health check, which doesn't query anything, and `src/models/index.js` only opens a Sequelize connection lazily on first query. `tests/app.test.js` covers exactly what exists (health check, 404 handling, Swagger UI) without needing a real DB.
This will change the moment a feature branch that queries the database (e.g. auth, or any real resource) merges in - at that point its own test suite will need a Postgres service in this workflow, the same way a from-scratch build of this exact CI setup for an auth-bearing branch already used one (`postgres:16` service container + `jest.config.js` `globalSetup`/`globalTeardown` creating a dedicated `_test` database). Adding that machinery now, before anything needs it, was deliberately skipped - it's easy to add when the first DB-dependent test actually lands, and speculative infrastructure for tests that don't exist yet is exactly the kind of premature complexity this project avoids (Q1, Q11).

### Q14: Why ESLint now, and why the minimal `eslint:recommended` config instead of Airbnb/Standard?
**A:** `eslint:recommended` (flat config, `eslint.config.js`) + Node globals, with one project-specific rule tweak: `no-unused-vars` ignores an unused `next` parameter, because Express identifies error-handling middleware purely by its 4-argument arity (`(err, req, res, next)`) - `next` must stay declared even when never called, or `errorHandler.middleware.js` silently stops being recognized as one.
`eslint:recommended` only flags likely bugs (unused vars, unreachable code, etc.), not style preferences - consistent with this project's "don't add tooling beyond what's needed" pattern. Airbnb/Standard were passed over because they'd flag a large volume of pre-existing, correct code purely for formatting/style reasons unrelated to correctness.

### Q15: What enforces lint/tests locally, before code even reaches a PR?
**A:** Husky git hooks: `pre-commit` runs `npm run lint` (fast, no DB needed), `pre-push` runs `npm test`.
This is a local convenience/fast-feedback layer, not the actual enforcement mechanism - a developer can always bypass hooks (`--no-verify`) or push from a machine without hooks installed, so the GitHub Actions check (Q12) + branch protection remain the real gate. Splitting lint (pre-commit) from tests (pre-push) instead of running both at both stages keeps the common case (committing) fast; it matters less here than it will once tests need a database (Q13), but the split is set up now so it doesn't need revisiting later.

---

## Template for new entries

```markdown
### Q: <question being decided>
**A:** <the choice made>
<1-3 sentences on why, including alternatives considered if relevant>
```
