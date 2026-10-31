# Demo readiness

Last rehearsal: 28 October 2026. The MOTOR-001 overheat flow completed with fresh safe telemetry; the incident stored a 13-second recovery duration. Elapsed time from injected sample to final event was approximately 15 seconds. Actual time depends on network, worker scheduling and simulator state.

Before presenting, run `npm run check` and then `npm run verify` with the services running. Rehearse one overheat cycle and confirm the Datadog viewer separately if that integration is part of the presentation.

## Preserved caveats

- A historical CONV-001 RPM incident, created before equipment-specific threshold selection was fixed, remains open for review. Its events were not erased or falsely marked as recovered. A live preflight may warn about it. Recheck requires a valid configured rule; it cannot force-close the old incident.
- Datadog's configured badge does not prove metrics/log delivery. APM also depends on a running, configured Agent.
- Sensors, diagnostic root causes and cooling/RPM actions are simulated. Do not describe them as commands issued to real hardware.
- Unit tests and mocked route integration checks do not replace a live rehearsal.
- The Docker compose file was validated; Docker images were not built/run during the structure refactor because the daemon was stopped.

The structure refactor does not require reseeding the database. See [the Vietnamese presentation](presentation-vi.md) for the three-minute sequence and [development notes](../development.md) for commands.
