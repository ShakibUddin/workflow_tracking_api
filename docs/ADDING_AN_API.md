# Adding a new API endpoint

A walkthrough of every layer you touch to add a new resource to this API, and
how to test it so the suite stays at 100% coverage (see [DECISIONS.md](../DECISIONS.md)
Q41–Q43). It uses the **Teams** feature as the worked example throughout,
since it's the first real (non-auth) resource built in this codebase and
touches every layer described here - open its files side by side with this
doc if anything is unclear.

## The layers, in the order data flows through them

```
route -> authenticate -> authorize -> validate(DTO) -> controller -> service -> repository -> model -> DB
```

For a new resource called (say) `widgets`, you'll typically touch:

| Layer | File | Owns |
|---|---|---|
| Migration | `src/database/migrations/<timestamp>-create-widgets.js` | The table schema |
| Model | `src/models/widget.model.js` | Sequelize definition + associations |
| Repository | `src/repositories/widget.repository.js` | Raw data access - the only layer that touches Sequelize models |
| Service | `src/services/widget.service.js` | Business rules, validation beyond shape, authorization decisions the router can't express |
| DTO | `src/dtos/widget.dto.js` | Joi request schemas + a response-shaping class |
| Controller | `src/controllers/widget.controller.js` | Thin - calls the service, shapes the response, forwards errors |
| Route | `src/routes/widget.routes.js` | Wires `authenticate`/`authorize`/`validate` + swagger-jsdoc annotations |
| Route registration | `src/routes/index.js` | `router.use('/widgets', widgetRoutes)` |
| Permissions (if any) | `src/constants/auth.constants.js` + two seeders | New `PERMISSIONS.WIDGET_*` entries and their grants |

Controllers never touch Sequelize models directly - only repositories do (see
[DECISIONS.md](../DECISIONS.md) Q2). Keep that boundary; it's what makes each
layer independently testable.

## Step by step

### 1. Migration + model

Add a migration under `src/database/migrations/` following the existing
naming convention (`<timestamp>-create-<table>.js` - see
`20260919010011-create-teams.js`). Then add `src/models/<name>.model.js`
mirroring `team.model.js`'s shape: `sequelize.define(...)` with
`underscored: true, timestamps: true`, and a static `.associate(models)` if
it relates to other tables. Run `npm run migrate` to apply it locally.

If the resource needs an enum-like status field, reuse the generic `lookup`
table (`type`/`label`/`value`) rather than a Postgres `ENUM` or a new
dedicated table - see [DECISIONS.md](../DECISIONS.md) Q17 for why, and
`20260919020005-seed-lookup-team-status.js` for the seeder pattern.

### 2. Repository

One class, one singleton export (`module.exports = new WidgetRepository();`),
methods that map close to a single query each - see `team.repository.js`.
Anything eager-loaded on every call (like Teams' `members`/`statusInfo`)
belongs in a shared `include` array at the top of the file, the same way
`user.repository.js`'s `defaultIncludes` does - this matters for testing
later (see the "defensive fallbacks" note below).

### 3. Service

This is where business rules live that a Joi schema or the `authorize`
middleware can't express - existence checks, uniqueness checks, cross-entity
validation, and any **resource-level** authorization (see below). Throw
`ApiError.notFound(...)` / `.conflict(...)` / `.badRequest(...)` /
`.forbidden(...)` / `.internal(...)` (`src/utils/ApiError.js`) rather than
shaping HTTP responses here directly.

### 4. DTOs

Two things live in `src/dtos/<name>.dto.js`:
- **Joi schemas** for each request shape (body/params) - see
  `createTeamSchema`/`teamIdParamsSchema` in `team.dto.js`.
- **A response-shaping class** (e.g. `TeamResponseDto`) with a `.from()`/`.fromList()`
  static, whitelisting exactly the fields that should reach the client.
  Never pass a raw Sequelize model instance straight to `res.json()` - it can
  leak internal columns (password hashes, FK ids) that were never meant to be public.

### 5. Controller

Keep it to: call the service, wrap the result in the response DTO, set the
status code, `catch (err) { next(err); }`. See `team.controller.js` - every
method follows that exact four-line shape. Don't put business logic here.

### 6. Routes

Compose the middleware chain in this order:
`authenticate` (is there a valid session?) → `authorize(PERMISSIONS.X)` (coarse
role-based check, if this action needs one) → `validate(schema, 'body' | 'params')`
(is the payload well-formed?) → the controller method. See `team.routes.js`.

Two things worth knowing before you reach for `authorize`:
- If "can this user act on this resource" depends on *which* resource (not
  just who the requester is - e.g. "is this user a member of *this* team"),
  `authorize` can't express that. Leave the route unguarded (or only
  `authenticate`d) and do the check in the service instead, like
  `team.service.js#getTeamDetail` does. See [DECISIONS.md](../DECISIONS.md) Q37.
- If a permission doesn't exist yet, add it to `PERMISSIONS` in
  `src/constants/auth.constants.js`, then grant it to whichever role(s) need
  it via a **new** seeder (don't edit an existing one - see the next section).

Register the router in `src/routes/index.js`:
`router.use('/widgets', widgetRoutes);`.

Add OpenAPI annotations as JSDoc comments above each route (see the
`@openapi` blocks in `team.routes.js`) - they're picked up automatically and
served at `/api-docs`.

### 7. Permissions and seeders - the one sharp edge

If you add new `PERMISSIONS` entries, grant them via a **brand-new** seeder
file with its own hardcoded array, e.g.:

```js
const WIDGET_PERMISSIONS = [PERMISSIONS.WIDGET_CREATE, PERMISSIONS.WIDGET_DELETE];
// ...bulkInsert role_permissions for WIDGET_PERMISSIONS...
```

**Never** write a seeder as `Object.values(PERMISSIONS)` or otherwise read
the live, shared `PERMISSIONS` object - a seeder is a historical record of
what existed *when it was written*. If it reads the live enum, every future
PR that adds a new permission key silently makes that old seeder try to
grant the new permission too, which breaks a from-empty `db:seed:all` with a
confusing unique-constraint error several files later. This actually
happened once - see [DECISIONS.md](../DECISIONS.md) Q39 for the full story.

## Testing what you built

Tests are Jest + Supertest, run against a real dedicated test Postgres
database - **not mocks** - because the whole point of testing a layered,
transactional API is proving the real behavior, not that a mock was called
correctly (see [DECISIONS.md](../DECISIONS.md) Q27). Put your tests under
`tests/<feature>/`, following `tests/teams/*.test.js`.

### The standard shape of a test file

```js
const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signupAdmin } = require('../helpers/auth');
const { createWidget /* , ... */ } = require('../helpers/widgets'); // add a helper file, see below

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /widgets', () => {
  it('...', async () => { /* ... */ });
});
```

- `resetMutableTables()` (`tests/helpers/db.js`) truncates the tables a test
  can actually mutate between every test. **Roles/permissions/lookup values
  are seeded once by `globalSetup` and never truncated** - if your test
  mutates one of those directly (e.g. to simulate missing seed data), you
  must restore it yourself, in a `try/finally`, so later tests aren't left
  broken. See `tests/teams/crud.test.js`'s "returns 500 when the ACTIVE
  TEAM_STATUS lookup seed is missing" test for the pattern.
- `afterAll(() => sequelize.close())` is required in every file - each test
  file gets its own isolated module registry and DB connection.
- Add a `tests/helpers/<feature>.js` file of thin Supertest wrappers (one
  function per endpoint), following `tests/helpers/teams.js` - keeps the
  actual test files readable.

### What to cover for a typical resource

Mirror `tests/teams/crud.test.js` + `tests/teams/members.test.js`: the happy
path, validation failures (400), not-found (404), conflicts (409) if
applicable, and a 403 test per permission you gated a route behind, plus a
401 test for at least one authenticated route. If you added a
resource-level (non-`authorize`) check like Q37's, test both sides of it
explicitly (the allowed case and the denied case).

### Reaching 100% coverage without contriving nonsense tests

Run `npm run test:coverage` and look at the `Uncovered Line #s` column
per-file. Most gaps are one of these; the right fix depends on which:

1. **A real branch your happy-path tests just didn't hit yet** (an error
   path, an edge case in an `if`). Add a normal integration test for it, the
   same way you tested everything else.
2. **A defensive fallback the repository layer never actually triggers**
   (e.g. `(thing.association || []).map(...)` where the repository always
   eager-loads `association`). Don't restructure the code to remove the
   guard - it's legitimate defense against a caller that isn't the
   repository. Instead, test the **service function directly** with a
   hand-built object that omits the association, optionally using
   `jest.spyOn(repository, 'method').mockResolvedValueOnce(...)` for exactly
   one call. See `tests/services/teamServiceEdgeCases.test.js` and
   `tests/services/teamServicePermissionFallback.test.js` for two variants
   of this pattern, and [DECISIONS.md](../DECISIONS.md) Q42–Q43 for why this
   doesn't conflict with the no-mocking rule (it's narrower: proving the
   service's own null-safety, never used to fake concurrency/transaction behavior).
3. **A controller's `catch (err) { next(err); }` for a call that can't fail
   on demand against a healthy real database** (e.g. a plain, unfiltered
   list query). `jest.mock()` the service in a small, dedicated test file
   (see `tests/controllers/errorPropagation.test.js`) and assert `next` was
   called with an error - this is proving plumbing, not business logic.
4. **Genuinely, structurally unreachable code** - e.g. a guard against a
   database state your migrations' foreign keys make impossible to produce
   without disabling constraint enforcement. Don't write a contrived test
   for this. Mark it with a one-line, specific `istanbul ignore next`
   comment explaining *why* it's unreachable (see the example in
   `token.service.js`'s `rotate()`), and add a line to
   [DECISIONS.md](../DECISIONS.md) if the reasoning isn't obvious from the
   comment alone.
5. **Dead code** - grep for the symbol; if nothing calls it, delete it
   instead of testing it (see [DECISIONS.md](../DECISIONS.md) Q42's
   `refreshTokenRepository.revoke()` example).

Whichever of these applies, `src/server.js` and `src/database/**` are
excluded from the coverage run entirely (`jest.config.js`'s
`collectCoverageFrom`) - you don't need to (and can't meaningfully) write
tests for a migration file or the process bootstrap.

## Checklist

- [ ] Migration + model
- [ ] Repository (real queries, one shared `include` for anything always eager-loaded)
- [ ] Service (business rules, resource-level auth if `authorize` can't express it)
- [ ] DTOs (Joi request schemas + a whitelisting response DTO)
- [ ] Controller (thin: call service, shape response, forward errors)
- [ ] Route (middleware order: `authenticate` → `authorize` → `validate` → controller; `@openapi` annotations)
- [ ] Registered in `src/routes/index.js`
- [ ] New permissions (if any) added to `auth.constants.js` + granted via a **new**, self-contained seeder
- [ ] `tests/helpers/<feature>.js` request wrappers
- [ ] Integration tests: happy path, validation (400), not found (404), conflicts (409) if relevant, 403 per permission, 401 for at least one route
- [ ] `npm run test:coverage` at 100% - real tests for real gaps, `istanbul ignore` only for genuinely unreachable defensive code, dead code deleted rather than tested
- [ ] `npm run lint` clean
