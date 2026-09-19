# Workflow Tracking API

Express + Sequelize REST API using a controller → service → repository architecture.

## Stack

- **Express** — HTTP layer
- **Sequelize** (PostgreSQL) — ORM
- **Joi** — DTO validation/shaping (`src/dtos`)
- **Winston** — logging (console in dev, `logs/combined.log` + `logs/error.log` always)
- **swagger-jsdoc** + **swagger-ui-express** — API docs at `/api-docs`
- **nodemon** — dev auto-reload

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
