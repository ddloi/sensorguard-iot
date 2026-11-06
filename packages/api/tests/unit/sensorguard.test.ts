import { describe, it, expect } from 'vitest';
import { ingestSchema } from '../../src/domain/telemetry';
import { findThresholdViolation, type ThresholdRule } from '../../src/domain/threshold';

/**
 * SensorGuard API — Unit Tests
 *
 * Tests validate core business logic without requiring database connections.
 * Focus areas: Model interfaces, threshold logic, data validation.
 */

// ─── Threshold Rule Tests ────────────────────────────────────────────────────

describe('Threshold Rule Logic', () => {
  const evaluateThreshold = (value: number, rule: ThresholdRule) =>
    findThresholdViolation(value, rule)?.severity ?? 'normal';

  const temperatureRule: ThresholdRule = {
    warning: { min: 10, max: 75 },
    critical: { min: 5, max: 85 },
  };

  it('should return "normal" for values within safe range', () => {
    expect(evaluateThreshold(45, temperatureRule)).toBe('normal');
    expect(evaluateThreshold(60, temperatureRule)).toBe('normal');
    expect(evaluateThreshold(74, temperatureRule)).toBe('normal');
  });

  it('should return "warning" when value crosses warning threshold', () => {
    expect(evaluateThreshold(75, temperatureRule)).toBe('warning');
    expect(evaluateThreshold(80, temperatureRule)).toBe('warning');
    expect(evaluateThreshold(10, temperatureRule)).toBe('warning');
  });

  it('should return "critical" when value crosses critical threshold', () => {
    expect(evaluateThreshold(85, temperatureRule)).toBe('critical');
    expect(evaluateThreshold(94, temperatureRule)).toBe('critical');
    expect(evaluateThreshold(5, temperatureRule)).toBe('critical');
    expect(evaluateThreshold(0, temperatureRule)).toBe('critical');
  });

  it('should handle null thresholds (disabled checks)', () => {
    const rpmRule: ThresholdRule = {
      warning: { min: null, max: 3500 },
      critical: { min: null, max: 4000 },
    };
    expect(evaluateThreshold(0, rpmRule)).toBe('normal');
    expect(evaluateThreshold(3500, rpmRule)).toBe('warning');
    expect(evaluateThreshold(4000, rpmRule)).toBe('critical');
  });
});

// ─── Sensor Data Validation Tests ────────────────────────────────────────────

describe('Sensor Data Validation', () => {
  const reading = { sensorType: 'temperature', value: 64.3, unit: 'celsius' };
  const payload = { deviceId: 'MOTOR-001', readings: [reading] };

  it('accepts a valid batch and supplies the default quality', () => {
    expect(ingestSchema.parse(payload).readings[0].quality).toBe('good');
  });
  it('accepts an explicit quality', () => {
    expect(
      ingestSchema.safeParse({
        ...payload,
        readings: [{ ...reading, quality: 'degraded' }],
      }).success,
    ).toBe(true);
  });
  it('rejects a missing deviceId', () => {
    expect(ingestSchema.safeParse({ readings: [reading] }).success).toBe(false);
  });
  it('rejects an unknown sensor type', () => {
    expect(
      ingestSchema.safeParse({
        ...payload,
        readings: [{ ...reading, sensorType: 'humidity' }],
      }).success,
    ).toBe(false);
  });
  it('rejects NaN readings', () => {
    expect(
      ingestSchema.safeParse({
        ...payload,
        readings: [{ ...reading, value: NaN }],
      }).success,
    ).toBe(false);
  });
  it('rejects infinite readings', () => {
    expect(
      ingestSchema.safeParse({
        ...payload,
        readings: [{ ...reading, value: Infinity }],
      }).success,
    ).toBe(false);
  });
  it('rejects empty batches and invalid payloads', () => {
    for (const invalid of [null, {}, { deviceId: 'MOTOR-001', readings: [] }]) {
      expect(ingestSchema.safeParse(invalid).success).toBe(false);
    }
  });
});

// ─── Incident Timeline Logic Tests ───────────────────────────────────────────

describe('Incident Lifecycle', () => {
  type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved';

  const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
    open: ['investigating'],
    investigating: ['mitigating', 'resolved'],
    mitigating: ['resolved'],
    resolved: [], // terminal state
  };

  function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('should allow open → investigating', () => {
    expect(canTransition('open', 'investigating')).toBe(true);
  });

  it('should allow investigating → mitigating', () => {
    expect(canTransition('investigating', 'mitigating')).toBe(true);
  });

  it('should allow investigating → resolved (skip mitigation)', () => {
    expect(canTransition('investigating', 'resolved')).toBe(true);
  });

  it('should allow mitigating → resolved', () => {
    expect(canTransition('mitigating', 'resolved')).toBe(true);
  });

  it('should NOT allow open → resolved (skip steps)', () => {
    expect(canTransition('open', 'resolved')).toBe(false);
  });

  it('should NOT allow resolved → anything (terminal)', () => {
    expect(canTransition('resolved', 'open')).toBe(false);
    expect(canTransition('resolved', 'investigating')).toBe(false);
  });

  it('should NOT allow going backwards', () => {
    expect(canTransition('mitigating', 'investigating')).toBe(false);
    expect(canTransition('investigating', 'open')).toBe(false);
  });
});

// ─── Remediation Strategy Tests ──────────────────────────────────────────────

describe('Remediation Strategy', () => {
  interface RemediationAction {
    rootCause: string;
    action: string;
  }

  function getRemediationForSensorType(sensorType: string): RemediationAction {
    const strategies: Record<string, RemediationAction> = {
      temperature: {
        rootCause: 'Bearing lubrication degradation causing friction and heat buildup',
        action: 'Reduces RPM by 50% and initiates emergency cooling cycle',
      },
      vibration: {
        rootCause: 'Shaft misalignment or bearing wear detected',
        action: 'Reduces operating speed and schedules maintenance inspection',
      },
      pressure: {
        rootCause: 'Pressure relief valve malfunction or blockage',
        action: 'Opens bypass valve and reduces pump output',
      },
      rpm: {
        rootCause: 'Motor controller instability or power supply fluctuation',
        action: 'Engages soft-start protocol and stabilizes power input',
      },
    };

    return (
      strategies[sensorType] ?? {
        rootCause: 'Unknown anomaly requiring manual investigation',
        action: 'Device placed in safe mode pending operator review',
      }
    );
  }

  it('should return temperature remediation for temperature type', () => {
    const result = getRemediationForSensorType('temperature');
    expect(result.rootCause).toContain('lubrication');
    expect(result.action).toContain('RPM');
    expect(result.action).toContain('cooling');
  });

  it('should return vibration remediation for vibration type', () => {
    const result = getRemediationForSensorType('vibration');
    expect(result.rootCause).toContain('alignment');
  });

  it('should return pressure remediation for pressure type', () => {
    const result = getRemediationForSensorType('pressure');
    expect(result.action).toContain('bypass');
  });

  it('should return fallback for unknown sensor type', () => {
    const result = getRemediationForSensorType('humidity');
    expect(result.rootCause).toContain('Unknown');
    expect(result.action).toContain('safe mode');
  });
});

// ─── Moving Average Utility Tests ────────────────────────────────────────────

describe('Moving Average Calculation (Client-side fallback)', () => {
  function calculateMovingAverage(values: number[], windowSize: number): number[] {
    if (windowSize <= 0 || values.length === 0) return [];
    return values.map((_, idx) => {
      const start = Math.max(0, idx - windowSize + 1);
      const window = values.slice(start, idx + 1);
      const sum = window.reduce((a, b) => a + b, 0);
      return Math.round((sum / window.length) * 100) / 100;
    });
  }

  it('should compute correct moving average', () => {
    const values = [10, 20, 30, 40, 50];
    const result = calculateMovingAverage(values, 3);
    expect(result).toEqual([10, 15, 20, 30, 40]);
  });

  it('should handle window larger than array', () => {
    const values = [5, 10];
    const result = calculateMovingAverage(values, 5);
    expect(result).toEqual([5, 7.5]);
  });

  it('should handle window of 1 (identity)', () => {
    const values = [1, 2, 3];
    const result = calculateMovingAverage(values, 1);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty for empty input', () => {
    expect(calculateMovingAverage([], 3)).toEqual([]);
  });

  it('should return empty for window size 0', () => {
    expect(calculateMovingAverage([1, 2], 0)).toEqual([]);
  });
});

// ─── Deduplication & Debounce Logic Tests ────────────────────────────────────

describe('Alert & Incident Deduplication Logic', () => {
  interface IncidentRecord {
    id: string;
    deviceId: string;
    status: 'open' | 'investigating' | 'mitigating' | 'resolved';
    timeline: string[];
  }

  function handleCriticalAlert(
    existingIncidents: IncidentRecord[],
    deviceId: string,
    alertMessage: string,
  ): { action: 'appended' | 'created'; incident: IncidentRecord } {
    const active = existingIncidents.find(
      (inc) => inc.deviceId === deviceId && inc.status !== 'resolved',
    );

    if (active) {
      active.timeline.push(alertMessage);
      return { action: 'appended', incident: active };
    }

    const newInc: IncidentRecord = {
      id: `inc-${Date.now()}`,
      deviceId,
      status: 'open',
      timeline: [alertMessage],
    };
    existingIncidents.push(newInc);
    return { action: 'created', incident: newInc };
  }

  it('should create new incident when no active incident exists', () => {
    const incidents: IncidentRecord[] = [];
    const res = handleCriticalAlert(incidents, 'MOTOR-001', 'Critical temp 95C');
    expect(res.action).toBe('created');
    expect(incidents.length).toBe(1);
    expect(res.incident.timeline).toEqual(['Critical temp 95C']);
  });

  it('should append to existing incident when one is already open', () => {
    const incidents: IncidentRecord[] = [
      { id: 'inc-1', deviceId: 'MOTOR-001', status: 'open', timeline: ['Initial alert'] },
    ];
    const res = handleCriticalAlert(incidents, 'MOTOR-001', 'Second burst alert');
    expect(res.action).toBe('appended');
    expect(incidents.length).toBe(1);
    expect(res.incident.timeline.length).toBe(2);
  });

  it('should create new incident if previous incident is already resolved', () => {
    const incidents: IncidentRecord[] = [
      { id: 'inc-old', deviceId: 'MOTOR-001', status: 'resolved', timeline: ['Old alert'] },
    ];
    const res = handleCriticalAlert(incidents, 'MOTOR-001', 'Fresh critical anomaly');
    expect(res.action).toBe('created');
    expect(incidents.length).toBe(2);
  });
});

// ─── Cache TTL Expiration Tests ──────────────────────────────────────────────

describe('In-Memory Telemetry & Device Cache', () => {
  class SimpleTTLCache<T> {
    private store = new Map<string, { value: T; expiresAt: number }>();

    set(key: string, value: T, ttlMs: number): void {
      this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    get(key: string): T | null {
      const item = this.store.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        this.store.delete(key);
        return null;
      }
      return item.value;
    }
  }

  it('should return cached value before expiry', () => {
    const cache = new SimpleTTLCache<string>();
    cache.set('MOTOR-001', 'Building A', 5000);
    expect(cache.get('MOTOR-001')).toBe('Building A');
  });

  it('should return null for expired key', () => {
    const cache = new SimpleTTLCache<string>();
    cache.set('MOTOR-001', 'Building A', -10); // already expired
    expect(cache.get('MOTOR-001')).toBeNull();
  });
});
