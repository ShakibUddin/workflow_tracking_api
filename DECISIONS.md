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

## Template for new entries

```markdown
### Q: <question being decided>
**A:** <the choice made>
<1-3 sentences on why, including alternatives considered if relevant>
```
