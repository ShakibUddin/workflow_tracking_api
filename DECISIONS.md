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

### Q12: How is the JWT delivered to the frontend?
**A:** As an httpOnly cookie, never in the JSON response body.
The frontend was specified to use httpOnly cookies. This means client-side JS can never read or exfiltrate the token (mitigates XSS token theft), at the cost of needing CORS configured with `credentials: true` and an explicit origin (not `*`) for cross-origin requests - see `CORS_ORIGIN` in `.env.example` and `app.js`.

### Q13: Access token and refresh token, or just one long-lived token?
**A:** Both - a short-lived access token (15m default) for authenticating requests, and a longer-lived refresh token (7d default, sliding) used only to mint new access tokens via `POST /auth/refresh-token`.
Limits the blast radius of a leaked access token to its short lifetime, while avoiding forcing the user to re-enter credentials every 15 minutes. Configurable via `JWT_ACCESS_EXPIRES_IN` / `REFRESH_TOKEN_TTL_DAYS`.

### Q14: How is the refresh token stored and validated server-side? *(superseded by Q19-Q21 - kept for history)*
**A:** ~~The `users.refresh_token` column stores the single currently-valid refresh token per user.~~ Replaced by the sessions/token-families/refresh-tokens model below once multi-session support and reuse detection were required - see Q19.

### Q15: Does `/auth/logout` require a valid access token?
**A:** No - it reads the refresh token cookie directly (not `req.user` from `authenticate.middleware.js`), resolves it to a session (`token.service.js#revokeByRawToken`), revokes that session's whole token family, and clears both cookies unconditionally either way (even if the cookie was missing or already stale).
Logout has to work even when the access token has already expired (its whole purpose is often to clean up after an expired/abandoned session), so gating it behind a valid access token would make it fail exactly when it's needed.

### Q16: bcrypt or bcryptjs for password hashing?
**A:** `bcryptjs` (pure JS implementation).
Avoids requiring a native build toolchain (node-gyp, a C++ compiler) to install `bcrypt`, which isn't guaranteed to be present on every dev/deploy machine (e.g. a bare Windows box). Slightly slower than the native version, which is an acceptable tradeoff at this scale.

### Q17: Why a generic `lookup` table for user status instead of a Postgres ENUM or a dedicated `user_statuses` table?
**A:** Matches the schema given: one reusable `lookup` table (`type` + `label` + `value`) that can hold `USER_STATUS` today and other enum-like reference data later without a new migration/table per concept.
The tradeoff is that `users.status` is just a plain FK integer with no database-level constraint tying it to `type = 'USER_STATUS'` specifically - that check only happens in application code (`auth.constants.js` + `lookupRepository.findByTypeAndValue`).

### Q18: How does a new signup get the `EMPLOYEE` role?
**A:** `auth.service.js#signup` looks up the `EMPLOYEE` role and the `ACTIVE` lookup row, then creates the user and the `user_roles` link inside one Sequelize transaction.
Every user must have exactly the default role assigned atomically with account creation - the transaction guarantees signup can't leave a user row with zero roles if the second insert fails. There's no self-service way to sign up as `ADMIN`; that must be granted separately (not yet built).

---

## Production-grade auth: sessions, token families, reuse detection

The single `users.refresh_token` column (Q14) couldn't support multiple concurrent sessions per user or detect a stolen-and-reused refresh token, so it was replaced with a three-table model: `sessions`, `token_families`, `refresh_tokens`.

### Q19: Why three separate tables (`sessions`, `token_families`, `refresh_tokens`) instead of one?
**A:** Each represents a genuinely different lifetime/concept:
- **`sessions`** = one logged-in device/browser. What the 3-per-user cap counts, what `authenticate.middleware.js` checks on every request, what "log out this device" means.
- **`token_families`** = the rotation lineage for one session's refresh tokens. Exists separately from `sessions` because its status has a third value sessions don't need - `COMPROMISED` (reuse detected) vs plain `REVOKED` (logout, eviction, expiry) - and because the family, not the session, is what a stolen token actually compromises.
- **`refresh_tokens`** = one row per issued token, forming the rotation history via `replaced_by_id` (a forward-linked list). This is the actual audit trail: "token 3 → 4 → 5, then 3 was replayed and the family died."

A flatter design (e.g. rotation state as columns directly on `sessions`) was considered and rejected: it would conflate "is this device logged in" with "is this specific token chain still trustworthy," which are different questions the moment reuse is detected (both die, but for different, separately-auditable reasons). The task explicitly asked not to simplify this away.

### Q20: Why opaque random refresh tokens (not JWTs), hashed at rest?
**A:** `crypto.randomBytes(64)` (512 bits) hex-encoded, hashed with SHA-256 before storage (`src/utils/refreshToken.js`) - the raw value is never persisted anywhere, only handed to the client once.
A JWT refresh token would carry claims and be self-verifying, which is exactly wrong for a token that must be revocable and single-use: with an opaque token, validity is *only* "does a matching, ACTIVE, unexpired hash exist in the DB," so revoking it is a single UPDATE, not something you have to wait out until it expires. Hashing means a database leak alone (backup, SQLi, insider) can never be turned back into a usable token, the same reasoning as password hashing. The access token stays a JWT (Q13) since it's short-lived and stateless-by-design.

### Q21: How does reuse detection work, and why revoke the *whole* family instead of just the replayed token?
**A:** Every refresh token is single-use (`status`: `ACTIVE` → `ROTATED`). If a token with status `ROTATED` or `REVOKED` is presented again, that can only mean someone other than the last legitimate rotator is holding it - `token.service.js#rotate` treats this as theft and immediately revokes the entire family: every `ACTIVE` token in it, the family itself (marked `COMPROMISED`, not just `REVOKED` - see the `revoked_reason` audit trail), and the owning session.
Revoking only the replayed token would leave the *current* legitimate-looking token (which the attacker may also hold, if they captured it mid-chain) still valid - killing the whole lineage is the only way to guarantee an attacker's foothold is actually closed. The cost: the legitimate user is also logged out and must re-authenticate. That's the correct tradeoff for a detected compromise, not a bug.

### Q22: How many sessions per user, and what happens on the (N+1)th login?
**A:** 3 by default (`MAX_ACTIVE_SESSIONS_PER_USER`). On login, if creating a new session would exceed the cap, the oldest-by-`last_used_at` session(s) are evicted (revoked, cascading to their family/tokens) *before* the new session is created - see `token.service.js#enforceSessionLimit`.
Eviction (not rejecting the new login) was chosen because rejecting a legitimate login for being "too logged in" is bad UX with no security benefit - the user is authenticating correctly, and the cap exists to bound total live credential material per account, not to gate access. `last_used_at` is a sliding value updated on every refresh, so "oldest" means "least recently active," not "oldest login," which evicts the session that's actually most likely abandoned.

### Q23: Where does concurrency protection actually happen, and what did the first implementation get wrong?
**A:** Every mutation to a session/family/refresh-token runs inside a Postgres transaction with the relevant rows locked via `SELECT ... FOR UPDATE` (`transaction.LOCK.UPDATE` in Sequelize) - the refresh token row, its token family, and (during rotation) the session row, plus the user's active-sessions set during login. This serializes concurrent operations against the same token/family/session so two simultaneous refreshes, or a login racing an eviction, can't both act on stale reads.
Two real bugs surfaced and were fixed while building this: (1) **`FOR UPDATE` + outer join**: locking a query that used Sequelize's `include` failed outright because Postgres refuses `FOR UPDATE` on the nullable side of an outer join - fixed by fetching the token and its family as two separate locked queries instead of one joined one (`refreshToken.repository.js`, `tokenFamily.repository.js`). (2) **Throwing inside a managed transaction rolls back everything in it**: the original reuse-detection code revoked the family *then threw* an `ApiError` from inside `sequelize.transaction(async (t) => {...})` to reject the request - Sequelize rolls back the whole transaction on any thrown error, silently undoing the revocation it had just performed. `token.service.js#rotate` now returns a `{ error }` / `{ tokens }` result from the callback and only throws *after* the transaction has committed, so a detected-reuse revocation always persists. Verified live: replaying a stale token now correctly kills the session for every subsequent request, including ones already holding the "current" token.

### Q24: What happens when the same still-valid refresh token is used by two truly concurrent requests (e.g. two tabs both refreshing at once)?
**A:** Exactly one wins the row lock and rotates successfully; every other concurrent request sees the token as already `ROTATED` by the time it acquires the lock and is treated as reuse - which revokes the whole session, logging out every tab, not just failing the losing request gracefully. Confirmed live by firing 5 simultaneous refreshes at one valid token: 1 succeeded, the rest got `reuse detected` / `session revoked`.
This is the well-known tradeoff of *strict* single-use rotation with no grace period: it has zero tolerance for legitimate races (double-fired requests, retried timeouts, multiple tabs refreshing near-simultaneously), because there's no way to distinguish that from an attacker replaying a captured token. The task asked for rotation to be enforced and reuse to revoke the session, so this implementation is strict by design. If this proves too aggressive in practice, the standard mitigation is a short grace window (e.g. a few seconds) during which the immediately-preceding token is still accepted and returns the *same* rotated pair rather than issuing a new one - deliberately not built here, since it's an explicit relaxation of "enforce rotation" that should be a separate, discussed decision rather than something quietly baked in.

### Q25: Why does `authenticate.middleware.js` do a database lookup on every request instead of trusting the JWT alone?
**A:** It verifies the access token's signature/expiry, then also checks that the session named in its `sid` claim is still `ACTIVE` and unexpired (`sessionRepository.findActiveById`).
A purely stateless JWT check would mean a revoked session (logout, reuse detection, eviction) keeps working for anyone holding its access token until that token's own short expiry catches up - up to 15 minutes of continued access after "revocation." Given the whole point of this task was correct revocation semantics, that gap was judged unacceptable; the DB round-trip per authenticated request is the deliberate cost of closing it. If this becomes a measured bottleneck, the standard fix is caching active-session lookups briefly (e.g. a few seconds) rather than removing the check.

### Q26: Why is `token_families.user_id` denormalized when it's derivable via `session_id → sessions.user_id`?
**A:** So "find/revoke everything for this user" queries don't require a join through `sessions`. It's kept in sync trivially because it's only ever written once, at family creation, alongside the session it belongs to - never updated afterward.

---

## Test suite

### Q27: What testing stack, and why integration tests against a real Postgres DB instead of mocking Sequelize?
**A:** Jest + Supertest, hitting `src/app.js` in-process (no server listening, no HTTP over the network) against a dedicated `<DB_NAME>_test` database, with `jest.config.js`'s `globalSetup`/`globalTeardown` creating that database and running the real migrations/seeders once per test run (`tests/globalSetup.js`), and each test file truncating the mutable tables between tests (`tests/helpers/db.js`).
Mocking Sequelize/the repositories was rejected: the entire point of this auth system is transaction behavior, row-level locking, and Postgres-specific semantics (`FOR UPDATE` + outer joins, advisory locks, phantom reads under `READ COMMITTED`) - a mock can only assert "the mock was called correctly," not "this is actually safe under concurrency." Two real bugs (Q28, and the transaction-rollback bug already in Q23) were only found because these are real integration tests against a real database. Tests run with `--runInBand` (serial) since they share one database - parallel Jest workers truncating/asserting against the same tables would interfere with each other.

### Q28: What did writing the concurrent-session-limit test find?
**A:** A genuine concurrency bug: firing 3 simultaneous logins at a user already at the session cap resulted in 4 active sessions, not 3. `SELECT ... FOR UPDATE` (used for reuse-detection locking in Q23) only locks rows that already exist - it does nothing to stop a concurrent transaction from *inserting* a new row matching the same query. Under `READ COMMITTED` (Postgres's default), three simultaneous logins each ran "count my active sessions" before any of them had committed their own new session row, so all three legitimately saw the same pre-eviction count, all three skipped eviction, and all three inserted - a classic phantom-read / write-skew race on a count-based invariant, which row locks alone cannot prevent.
Fixed with a Postgres advisory lock (`pg_advisory_xact_lock`, keyed by `user_id`, transaction-scoped) acquired at the top of `token.service.js#issueSessionTokens`, before the session count is read. This serializes every login for the *same* user through the count-then-evict-then-insert section - concurrent logins for *different* users are completely unaffected, since the lock key is per-user. Verified with a test firing `maxSessions` simultaneous logins and asserting the active count never exceeds the cap; also re-ran the full suite twice more to confirm the fix isn't merely timing-lucky.

---

## CI / merge gate

*(Q29-Q32 below were built independently on a separate branch, off bootstrap-only `main`, before this branch's auth work existed - merged in here, with Q30 updated to reflect that a Postgres service is now actually needed.)*

### Q29: What runs before a PR can merge into `main`, and where is it defined?
**A:** A GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on every PR targeting `main` (and on direct pushes to `main`): install deps, `npm run lint` (ESLint), then `npm test` (Jest + Supertest, against a `postgres:16` service container - see Q30). No separate "build" step - there's nothing to compile in a plain Node/Express app, so a clean `npm ci` + passing lint + passing tests *is* the build check.
Branch protection (requiring this workflow's check to pass, and requiring a PR before merging) is a GitHub *repository setting*, not something expressed in code - it has to be turned on once in GitHub's UI (Settings → Branches → branch protection rule for `main` → require the `lint-and-test` status check).

### Q30: Does CI need a Postgres service container?
**A:** Yes, as of this merge. The CI workflow was originally built (on a separate branch, off bootstrap-only `main`, before this auth work existed) for a codebase where nothing queried the database, so it shipped without one. That's no longer true - `tests/auth/*.test.js` (Q27) needs a real database for its `globalSetup`/`globalTeardown` to create - so merging this branch means adding the `postgres:16` service container (matching local `npm test`'s `DB_*` env vars) back into `ci.yml` as part of the merge itself, not as a follow-up.
This is a concrete instance of the tradeoff named in the original decision: deferring infrastructure until it's needed works fine right up until something needs it, and then it has to actually get added - which is what happened here.

### Q31: Why ESLint, and why the minimal `eslint:recommended` config instead of Airbnb/Standard?
**A:** `eslint:recommended` (flat config, `eslint.config.js`) + Node globals, with one project-specific rule tweak: `no-unused-vars` ignores an unused `next` parameter, because Express identifies error-handling middleware purely by its 4-argument arity (`(err, req, res, next)`) - `next` must stay declared even when never called, or a middleware like `errorHandler.middleware.js` or `authenticate.middleware.js` silently stops being recognized as one.
`eslint:recommended` only flags likely bugs (unused vars, unreachable code, etc.), not style preferences - consistent with this project's "don't add tooling beyond what's needed" pattern. Airbnb/Standard were passed over because they'd flag a large volume of pre-existing, correct code purely for formatting/style reasons unrelated to correctness.

### Q32: What enforces lint/tests locally, before code even reaches a PR?
**A:** Husky git hooks: `pre-commit` runs `npm run lint` (fast, no DB needed), `pre-push` runs `npm test` (needs a local Postgres instance, per Q30 - pushing is a less frequent action than committing, so that cost is paid less often).
This is a local convenience/fast-feedback layer, not the actual enforcement mechanism - a developer can always bypass hooks (`--no-verify`) or push from a machine without hooks installed, so the GitHub Actions check (Q29) + branch protection remain the real gate.

---

## RBAC

### Q33: How is RBAC modeled, and why weren't `permissions`/`role_permissions` already there?
**A:** Two new tables, `permissions` (`id`, `name` unique) and `role_permissions` (join table on `role_id`/`permission_id`, unique pair), added as ordinary migrations/models/seeders following the exact conventions `roles`/`user_roles` already used (BIGINT PKs, `underscored: true`, snake_case, timestamps). `Role.belongsToMany(Permission)` mirrors `Role.belongsToMany(User)`.
Only `roles` existed beforehand - `permissions` and `role_permissions` were assumed to already exist going into this work but didn't (verified against both the migrations directory and the live DB), so this had to build them rather than "wire up to what's there."
`permissions.name` is an action string (e.g. `user:manage`), never a URL/route - so it stays meaningful if a route is renamed or the same action becomes reachable from more than one endpoint. Enforcement checks membership in this string list, nothing more (no wildcards, no hierarchy, no resource-attribute policies) - see Q11's precedent against over-building ahead of real requirements.

### Q34: How does a request know what a user is allowed to do - re-query the DB, or trust the token?
**A:** Trust the token, same as roles already do (Q12-Q13). At sign-in/signup/refresh, `token.service.js` resolves `roles -> role_permissions -> permissions` (`role.repository.js#findPermissionNamesByRoleNames`, via `permission.service.js`) once and embeds the resulting action-string array as `permissions` in the access-token payload, right next to `roles`. `authenticate.middleware.js` copies it onto `req.user.permissions` with zero extra DB work, and the new `authorize.middleware.js` just checks array membership.
The alternative (query `role_permissions` on every request) was rejected for the same reason roles never do that: it would be an inconsistent, extra DB round-trip layered on top of the per-request session-validation query that already exists (Q25), for a system where roles/permissions change rarely. The real cost is the same staleness window roles already accept: a role/permission change takes up to `JWT_ACCESS_EXPIRES_IN` (15m default) to reach an already-issued token. `GET /auth/me` is the one exception - like its `roles` field, it resolves `permissions` fresh from the DB on every call (`auth.service.js#getProfile`), so a client that wants to know "what can I do right now" (as opposed to "what could I do as of my last token issuance") has a way to ask.

### Q35: Where is `authorize` actually applied, and what permissions were seeded?
**A:** Nowhere yet, by design. This branch only has auth endpoints (`signup`/`signin`/`refresh-token`/`logout`/`me`) and no domain resource (no workflow/task/etc. controller exists - see Q11), so there is currently no real endpoint that should be gated behind a specific action permission. What was built is the infrastructure: the tables, JWT embedding, `GET /auth/me` returning `permissions` for the frontend to show/hide actions with, and a generic `authorize(...permissions)` middleware (`src/middlewares/authorize.middleware.js`, covered by unit tests in `tests/auth/permissions.test.js`) ready to drop onto a route the moment one needs it, e.g. `router.delete('/workflows/:id', authenticate, authorize('workflow:delete'), ...)`.
A small starter permission set (`PERMISSIONS` in `auth.constants.js`: `user:manage`, `role:manage`, `session:manage`) was seeded and granted entirely to `ADMIN` (`EMPLOYEE` gets none) purely as a working example of the roles->role_permissions->permissions chain - not a real authorization policy. These names/grants are expected to be replaced/extended once real domain permissions are known; nothing in the codebase depends on their specific values.

---

## Template for new entries

```markdown
### Q: <question being decided>
**A:** <the choice made>
<1-3 sentences on why, including alternatives considered if relevant>
```
