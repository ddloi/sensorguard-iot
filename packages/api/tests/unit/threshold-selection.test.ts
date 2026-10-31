import { describe, expect, it } from 'vitest';
import { selectThreshold } from '../../src/domain/threshold';

const rules = [
  { deviceId: '*', deviceType: 'pump', sensorType: 'pressure', limit: 100 },
  { deviceId: '*', deviceType: 'compressor', sensorType: 'pressure', limit: 140 },
  { deviceId: '*', deviceType: 'motor', sensorType: 'temperature', limit: 90 },
  { deviceId: 'MOTOR-001', deviceType: 'motor', sensorType: 'temperature', limit: 85 },
  { deviceId: '*', deviceType: 'motor', sensorType: 'rpm', limit: 500 },
];

describe('Equipment-specific threshold selection', () => {
  it('uses compressor pressure rather than the earlier pump pressure rule', () => {
    expect(selectThreshold(rules, 'COMP-001', 'compressor', 'pressure')?.limit).toBe(140);
  });
  it('does not apply motor minimum RPM to a conveyor', () => {
    expect(selectThreshold(rules, 'CONV-001', 'conveyor', 'rpm')).toBeUndefined();
  });
  it('prefers the demo motor override to the generic motor rule', () => {
    expect(selectThreshold(rules, 'MOTOR-001', 'motor', 'temperature')?.limit).toBe(85);
    expect(selectThreshold(rules, 'MOTOR-002', 'motor', 'temperature')?.limit).toBe(90);
  });
});
