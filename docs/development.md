# Development

## Setup

Install the Node/npm versions required in the root `package.json`, then run `npm ci` from the repository root. Copy `.env.example` to `.env` and supply MongoDB/Redis settings; Datadog credentials are optional for the core dashboard.

Do not commit `.env`, local installers or connection strings. `.local/` holds machine-specific material and is ignored by Git, the formatter and Docker build context.

## Commands

| Command                     | Effect                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`               | Run API, simulator and Vite dashboard together                         |
| `npm run dev:api`           | Run only the API with source watching                                  |
| `npm run dev:dashboard`     | Run only the dashboard on port 3000                                    |
| `npm run dev:simulator`     | Run only the five-device telemetry generator                           |
| `npm run scenario:overheat` | Send the longer narrated overheat scenario; writes telemetry/incidents |
| `npm run check`             | Types, tests, builds and formatting; no running database required      |
| `npm test`                  | API unit and route integration tests                                   |
| `npm run typecheck`         | Check all workspace types without emitting build files                 |
| `npm run build`             | Produce API/simulator `dist/` and dashboard assets                     |
| `npm run verify`            | Read-only checks of live dependencies, fresh data and WebSocket        |
| `npm run format`            | Format supported source, configuration and current documentation       |
| `npm run format:check`      | Fail on formatting drift                                               |
| `npm run seed`              | Delete and replace initial demo devices/rules/alerts/incidents         |

Run `npm run check` before review. CI executes builds, type checks, tests and formatting and must fail on a failed check. The manual diagnostic at `packages/api/scripts/dev/debug-threshold.ts` creates a queue job; it is deliberately excluded from routine tests/checks.

## Configuration and working directories

API and simulator `.env` resolution is anchored to their module locations, so running built code from the repository root works as well as npm workspace scripts. The simulator and live preflight use `API_URL`; older `NEXT_PUBLIC_API_URL` remains a simulator fallback for existing local configurations. New setups should use the current `.env.example`.

The dashboard uses relative requests. Vite proxies to `127.0.0.1:3001` in development. Production Nginx proxies to the compose service `api:3001`. Neither requires credentials compiled into browser assets.

## Docker

The compose stack contains the API, simulator, built dashboard and Datadog Agent. MongoDB Atlas and Redis are external services. The dashboard is available on port 3000, the API on 3001. Datadog Agent APM/DogStatsD ports are exposed for local observability.

```bash
docker compose config --quiet
npm run docker:up
npm run docker:logs
npm run docker:down
```

Dockerfiles use `npm ci` against the committed lockfile and separate build/runtime stages. API and simulator run as the Node image's non-root user. Nginx provides SPA fallback and HTTP/WebSocket forwarding.

The configuration was checked locally; images were not built or started during the structure refactor because the Docker daemon was stopped. Validate image builds in an environment with Docker running before relying on container deployment for a presentation.

## Database setup and indexes

Do not rerun seed merely to clear a warning. Preserve existing incident evidence and investigate the underlying configuration. The threshold unique key includes `deviceId`, `deviceType` and `sensorType`; an older database may still have the former `deviceId + sensorType` unique index. Inspect and plan any migration explicitly before reseeding that database.

## Reports and historical files

Current guidance is in `README.md`, `docs/architecture.md`, this document and `docs/demo/`. `PRODUCT.md` and `DESIGN.md` document product and visual decisions. Earlier pipeline/design/architecture snapshots are in `docs/archive/` and do not certify the current runtime.

The existing comparison DOCX is in `docs/reports/`. Its optional historical generator requires Python and `python-docx` and accepts an explicit destination:

```text
python scripts/reports/generate_comparison_report.py --output docs/reports/comparison-copy.docx
```

Do not regenerate it as part of `check` or overwrite review artifacts incidentally.
