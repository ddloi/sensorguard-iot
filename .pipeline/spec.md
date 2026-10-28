# 🛡️ SensorGuard — Architecture & System Spec
> Pipeline State: AI-DEV-TEAM Stage 1 Specification

## 1. System Overview
SensorGuard is a real-time Industrial IoT Operations & Anomaly Detection Center built for the MongoDB × Datadog Hackathon 2026.
- **Architecture Pattern:** Event-Driven Microservices Monorepo (`npm workspaces`).
- **Core Stacks:**
  - Fastify 5.x + TypeScript + WebSocket (`packages/api`)
  - MongoDB Atlas Time Series Collection (`sensor_data`) with `$setWindowFields` moving average
  - BullMQ + Upstash Redis Distributed Queue Workers
  - React 19 + Vite 6 + Tailwind/Vanilla CSS SCADA NOC Dashboard (`packages/dashboard`)
  - IoT Industrial Simulator (`packages/simulator`)
  - Datadog Cloud APM, Metrics (`hot-shots` / HTTP), and Log Ingestion

## 2. API & Data Contracts
- `POST /api/ingest`: High-throughput sensor ingestion into MongoDB Time Series collection.
- `GET /api/devices`: Status of industrial fleet (Motors, Pumps, Compressors, Conveyors).
- `GET /api/incidents`: Lifecycle of alerts (Anomaly → Investigation → Remediation → Resolved).
- `GET /api/analytics/timeseries`: Real-time 5-minute Moving Average calculated natively via MongoDB `$setWindowFields`.

## 3. Reliability & Self-Healing Loop
- **Detection:** `ThresholdWorker` evaluates sensory data against warning and critical boundaries.
- **Triage:** `AlertWorker` correlates anomalies into deduplicated Incidents with automated root-cause analysis.
- **Remediation:** `RemediationWorker` triggers cooling cycles, RPM load reduction, and verifies recovery.
- **Health:** `DeviceHealthWorker` marks inactive devices offline if heartbeat > 30s.
