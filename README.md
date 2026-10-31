# SensorGuard

Industrial IoT monitoring demo for the MongoDB × Datadog Hackathon: simulated sensor data, time-series analytics, incident processing and evidence-based recovery.

## Run locally

Use Node.js 20+ and npm 10+. MongoDB Atlas and Redis are external services. Datadog is optional for local monitoring; verify actual delivery before presenting its integration.

```bash
npm ci
```

Copy `.env.example` to `.env` and provide your connection settings. Keep credentials on the server; never put them in `VITE_*` variables.

For a **new, empty demo database only**, run `npm run seed`. This command deletes and replaces devices, thresholds, alerts and incidents. Existing demo databases do not need reseeding after UI or structure changes.

```bash
npm run dev
```

Open [the dashboard](http://localhost:3000). The API listens on port 3001 and the simulator sends readings every five seconds. To check running services:

```bash
npm run verify
```

## Project layout

```text
sensorguard/
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/       # Environment and external connections
│   │   │   ├── domain/       # Pure threshold and recovery rules
│   │   │   ├── models/       # MongoDB schemas
│   │   │   ├── queues/       # BullMQ queues
│   │   │   ├── routes/       # HTTP and WebSocket entry points
│   │   │   ├── services/     # Use cases and dependency health
│   │   │   ├── utils/        # Logging and WebSocket infrastructure
│   │   │   └── workers/      # Background incident processing
│   │   ├── scripts/          # Explicit database setup and manual diagnostics
│   │   └── tests/            # unit/ and integration/
│   ├── dashboard/
│   │   ├── src/
│   │   │   ├── api/          # Typed HTTP client
│   │   │   ├── components/   # Reusable UI and application shell
│   │   │   ├── features/     # Telemetry, incidents and architecture screens
│   │   │   ├── hooks/        # State, polling, WebSocket and demo actions
│   │   │   ├── types/        # Dashboard data contracts
│   │   │   └── utils/        # Presentation helpers
│   │   └── nginx.conf        # Container proxy and SPA fallback
│   └── simulator/
│       └── src/              # Configuration, equipment and scenarios
├── scripts/
│   ├── verify-stack.ts       # Read-only live preflight
│   └── reports/              # Historical report generator
├── datadog/                  # Dashboard and monitor definitions
├── docs/                     # Architecture, development and demo guides
│   ├── demo/
│   ├── reference/
│   ├── reports/
│   └── archive/              # Historical design/pipeline material
├── PRODUCT.md                # Product purpose and design principles
├── DESIGN.md                 # Current visual system
├── tsconfig.base.json        # Shared strict TypeScript settings
└── docker-compose.yml        # API, dashboard, simulator and Datadog Agent
```

The three workspaces are independently buildable. Domain rules do not import Fastify or React; browser code communicates through HTTP and WebSocket instead of importing API implementation files.

## Validation

```bash
npm run check         # Types, unit/integration tests, builds and formatting
npm run verify        # Running API, data, WebSocket and dashboard checks
npm run format        # Apply consistent formatting
```

`check` requires no cloud credentials or running database. `verify` needs the stack running and does not trigger an incident or reset data. CI fails when tests or formatting fail.

## Demo

Click **Chạy demo quá nhiệt** for MOTOR-001. The dashboard opens incident history and follows detection, simulated diagnosis/mitigation and recovery confirmed from fresh safe readings. A failed verification stays visible for operator review; **Kiểm tra phục hồi lại** starts another bounded check without force-closing the incident.

Sensor input, root-cause diagnosis and cooling actions are simulated. MongoDB storage, BullMQ processing and incident records use the configured services. The Datadog badge reports configuration, not proof of ingestion.

- [Architecture and boundaries](docs/architecture.md)
- [Development and commands](docs/development.md)
- [Three-minute presentation, Vietnamese](docs/demo/presentation-vi.md)
- [Demo readiness and caveats](docs/demo/readiness.md)
- [Technology and Datadog reference](docs/reference/technology-and-datadog-agent.txt)
- [Historical material](docs/archive/README.md)

## Docker

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

The dashboard container serves the built SPA and proxies `/api`, `/health` and `/ws` to the API. MongoDB and Redis remain external; the compose stack includes the Datadog Agent. Configure `.env` first. See [development notes](docs/development.md#docker) for validation limits.

MIT
