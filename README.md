# 🛡️ SensorGuard — Industrial IoT Operations Center

[![CI Pipeline](https://github.com/ddloi/sensorguard-iot/actions/workflows/ci.yml/badge.svg)](https://github.com/ddloi/sensorguard-iot/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-32%20passed-success.svg)](https://vitest.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black.svg)](https://fastify.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Time%20Series%20%2B%20Windowing-green.svg)](https://www.mongodb.com/)
[![Datadog](https://img.shields.io/badge/Datadog-APM%20%2B%20Metrics%20%2B%20Monitors-purple.svg)](https://www.datadoghq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Real-time Industrial IoT Monitoring, Anomaly Detection & Self-Healing Architecture**  
> Built for the **MongoDB × Datadog Hackathon 2026** (MongoDB User Group Vietnam)

---

## 🏗️ Architecture

```
                                      ┌────────────────────────┐
                                      │   Datadog Cloud (US1)  │
                                      │  APM, Metrics & Logs   │
                                      └───────────▲────────────┘
                                                  │ (APM + StatsD/Logs)
┌───────────────────────┐  HTTP POST  ┌───────────┴────────────┐
│  IoT Sensor Simulator │ ──────────→ │   Fastify Backend API  │
│  (5 Industrial Units) │  /api/ingest│       (:3001)          │
└───────────────────────┘             └─────┬──────────────┬───┘
                                            │              │
                   ┌────────────────────────┘              └────────────────────────┐
                   ▼                                                                ▼
      ┌─────────────────────────┐                                      ┌─────────────────────────┐
      │   MongoDB Atlas Cloud   │                                      │  Upstash Redis (BullMQ) │
      │   (Time Series Engine)  │                                      │  Distributed Queues     │
      └────────────┬────────────┘                                      └────────────┬────────────┘
                   │                                                                │
                   │ Aggregation Pipeline                                           ├── threshold-check
                   │ ($setWindowFields)                                             ├── alert-process
                   │                                                                ├── remediation (2-stage non-blocking)
                   ▼                                                                └── device-health
      ┌─────────────────────────┐                                                   │
      │   React + Vite SCADA    │ ◄─────────────────────────────────────────────────┘
      │   Operations Center     │      WebSocket (/ws) + In-Memory Cached Analytics
      │        (:3000)          │
      └─────────────────────────┘
```

---

## 🚀 Quick Start for Collaborators

### 1. Prerequisites
- **Node.js 20+** (Tested on Node 20 / 22)
- **npm 10+** (Monorepo workspaces support)
- Cloud Accounts (Free tiers):
  - **MongoDB Atlas** (M0 Free Cluster)
  - **Upstash Redis** (Serverless Free Tier)
  - **Datadog** (Trial or Organization API Key)

---

### 2. Clone & Environment Setup

```bash
git clone <repo-url>
cd sensorguard

# Create local environment config from template
cp .env.example .env
```

Open `.env` and fill in your cloud connection credentials:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/sensorguard?retryWrites=true&w=majority
UPSTASH_REDIS_URL=rediss://<endpoint>:6379
UPSTASH_REDIS_TOKEN=<token>
DD_API_KEY=<your-datadog-api-key>
DD_SITE=datadoghq.com
```

---

### 3. Install Dependencies & Seed Database

```bash
# Install all workspace dependencies
npm install

# Seed 5 industrial devices & 11 threshold rules into MongoDB
npm run seed
```

---

### 4. Run the Full Stack (3 Services)

**Option A — Single Terminal (Recommended):**
Run all 3 services concurrently in one single terminal:

```bash
npm run dev
```

**Option B — Multi-Terminal:**
If you prefer dedicated terminals for separate logs:

```bash
# Terminal 1: Fastify Backend API (Port 3001)
npm run dev:api

# Terminal 2: IoT Sensor Simulator (Streaming telemetry every 5s)
npm run dev:simulator

# Terminal 3: SCADA Operations Dashboard (Port 3000)
npm run dev:dashboard
```

Once running, navigate to:
👉 **`http://localhost:3000`**

---

### 5. Run the Demo Failure Scenario (Overheat & Auto-Recovery)

You can trigger the overheat failure scenario in two ways:
1. **From the Dashboard UI**: Click the **"Demo Quá Nhiệt"** button in the header.
2. **From Terminal**:
   ```bash
   npm run scenario:overheat
   ```

**What happens:**
1. `MOTOR-001` temperature spikes from 64°C to **94°C** (>85°C critical threshold).
2. `threshold-check` worker detects anomaly ➜ `alert-process` creates a Critical Incident.
3. System identifies root cause: *Bearing lubrication degradation causing friction and heat buildup*.
4. `remediation` worker automatically triggers mitigation: *Reduces RPM by 50% and initiates emergency cooling cycle*.
5. Temperature stabilizes back down to **~64°C** within ~26 seconds, incident marked **✓ RESOLVED**.

---

### 6. Automated Testing & Quality Assurance

Run the comprehensive unit test suite covering threshold checking, sensor validation, incident state machine, remediation triggers, and windowed averages:

```bash
# Run all unit tests (27 tests across 5 test suites)
npm test
```

---

### 7. Pre-Demo Stack Verification

SensorGuard includes an automated pre-flight check script to verify full-stack readiness before any live demo or presentation:

```bash
# Verify API, Database, Incidents, Analytics, and Dashboard health
npm run verify
```

---

## 📊 Monorepo Structure

```
sensorguard/
├── .github/
│   └── workflows/ci.yml      # GitHub Actions CI matrix pipeline (Node 20 & 22)
├── datadog/
│   ├── dashboard.json        # Exportable Datadog SCADA Dashboard (8 widgets)
│   └── monitors.json         # Datadog Alert Monitors (SLO, temperature, ingestion)
├── scripts/
│   ├── verify-stack.ts       # Automated pre-demo diagnostic & health checker
│   └── generate_docx_report.py # Automated technical report generator
├── packages/
│   ├── api/                  # Fastify 5.x API, MongoDB models, BullMQ workers, Datadog tracer
│   │   ├── src/
│   │   │   ├── config/       # Env validation (Zod), Redis (Upstash), Datadog StatsD
│   │   │   ├── models/       # Mongoose schemas (Time Series, Device, Alert, Incident)
│   │   │   ├── queues/       # BullMQ queues & worker definitions
│   │   │   ├── routes/       # RESTful endpoints (/api/ingest, /api/analytics, /api/incidents)
│   │   │   └── workers/      # ThresholdWorker, AlertWorker, RemediationWorker, DeviceHealthWorker
│   │   └── scripts/seed.ts   # Database seeder
│   │
│   ├── dashboard/            # SCADA Operations Control Center (React 19 + Vite)
│   │   ├── src/
│   │   │   ├── App.tsx       # Main NOC console: Topology, Radial Gauges, Timeline, Time Series
│   │   │   ├── index.css     # Dark/Light SCADA design system with glassmorphism & ambient glow
│   │   │   └── main.tsx
│   │   └── vite.config.ts    # Reverse-proxies /api requests to :3001
│   │
│   └── simulator/            # Synthetic Industrial IoT Telemetry Generator
│       ├── src/
│       │   ├── devices.ts    # 5 Industrial devices (Motors, Pumps, Compressors, Conveyors)
│       │   ├── index.ts      # Continuous telemetry loop (Gaussian noise)
│       │   └── scenarios/    # Overheat & failure simulation scripts
│
├── ARCHITECTURE_STATE.md     # Single Source of Truth for architecture & model context
├── SensorGuard_Demo_Presentation_Script.md # 3-minute hackathon pitch script
├── docker-compose.yml        # Container orchestration
├── .env.example              # Environment variable template
└── package.json              # Monorepo root scripts & workspace config
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | API & database health status |
| `POST` | `/api/ingest` | Ingest sensor telemetry batch |
| `GET` | `/api/devices` | List registered industrial devices |
| `GET` | `/api/incidents` | Lifecycle incidents (Active & Resolved) |
| `GET` | `/api/analytics/timeseries` | Time Series telemetry with **MongoDB `$setWindowFields` Moving Average** |
| `GET` | `/api/analytics/device-health` | Fleet-wide health matrix & last seen timestamps |
| `GET` | `/api/analytics/anomalies` | Detected sensor outliers & threshold breaches |

---

## 🏆 Key Hackathon Highlights for Judges

1. **MongoDB Time Series Collections**: Highly compressed columnar storage tailored for high-velocity sensor telemetry (`granularity: 'seconds'`).
2. **Real-time Windowing Aggregation**: `$setWindowFields` calculates 5-minute moving averages dynamically across streaming data to eliminate sensor noise.
3. **Event-Driven Resilience**: Asynchronous decoupling using BullMQ over Upstash Redis prevents ingest bottlenecks during alert storms.
4. **Full Observability**: Datadog APM tracing, custom metrics (StatsD), and lifecycle recovery logs.
5. **Self-Healing Loop**: Closed-loop automation: **Detect ➜ Root Cause ➜ Remediate ➜ Verify Recovery**.

---

## 📝 License

MIT
