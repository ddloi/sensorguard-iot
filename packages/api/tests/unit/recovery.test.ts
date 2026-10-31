import { describe, expect, it } from 'vitest';
import { isRecoveryConfirmed } from '../../src/domain/recovery';

const now = Date.now();
const startedAt = new Date(now - 60000);
const threshold = { warning: { min: null, max: 80 }, critical: { min: null, max: 85 } };

describe('Telemetry-confirmed recovery', () => {
  it('confirms a new, recent sample inside the safety band', () => {
    expect(
      isRecoveryConfirmed(
        { timestamp: new Date(now - 5000), value: 64 },
        threshold,
        startedAt,
        now,
      ),
    ).toBe(true);
  });
  it('does not resolve from an unsafe or warning reading', () => {
    for (const value of [80, 85, 94, NaN]) {
      expect(
        isRecoveryConfirmed({ timestamp: new Date(now), value }, threshold, startedAt, now),
      ).toBe(false);
    }
  });
  it('does not resolve from stale, future, missing, or pre-incident telemetry', () => {
    expect(isRecoveryConfirmed(null, threshold, startedAt, now)).toBe(false);
    expect(
      isRecoveryConfirmed(
        { timestamp: new Date(now - 31000), value: 64 },
        threshold,
        startedAt,
        now,
      ),
    ).toBe(false);
    expect(
      isRecoveryConfirmed(
        { timestamp: new Date(now - 70000), value: 64 },
        threshold,
        startedAt,
        now,
      ),
    ).toBe(false);
    expect(
      isRecoveryConfirmed(
        { timestamp: new Date(now - 3000), value: 64 },
        threshold,
        new Date(now - 2000),
        now,
      ),
    ).toBe(false);
    expect(
      isRecoveryConfirmed(
        { timestamp: new Date(now + 10000), value: 64 },
        threshold,
        startedAt,
        now,
      ),
    ).toBe(false);
    expect(
      isRecoveryConfirmed({ timestamp: 'invalid', value: 64 }, threshold, startedAt, now),
    ).toBe(false);
  });
  it('requires a threshold and respects lower safety limits', () => {
    expect(isRecoveryConfirmed({ timestamp: new Date(now), value: 64 }, null, startedAt, now)).toBe(
      false,
    );
    const pressure = { warning: { min: 30, max: 100 }, critical: { min: 20, max: 130 } };
    expect(
      isRecoveryConfirmed({ timestamp: new Date(now), value: 25 }, pressure, startedAt, now),
    ).toBe(false);
  });
});
