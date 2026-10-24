/**
 * DEVICE DEFINITIONS — Simulated factory equipment.
 * 
 * Each device has multiple sensors. These definitions are used
 * both for seeding the MongoDB devices collection and for the
 * simulator to know what data to generate.
 * 
 * Normal operating ranges are realistic for industrial equipment.
 */

export interface DeviceDefinition {
  id: string;
  name: string;
  type: 'motor' | 'pump' | 'compressor' | 'conveyor';
  location: string;
  sensors: SensorDefinition[];
  metadata: {
    manufacturer: string;
    model: string;
    serialNumber: string;
  };
}

export interface SensorDefinition {
  type: 'temperature' | 'vibration' | 'pressure' | 'rpm';
  unit: string;
  normalMin: number;  // Normal operating range lower bound
  normalMax: number;  // Normal operating range upper bound
  absoluteMin: number; // Physical minimum
  absoluteMax: number; // Physical maximum
}

export const DEVICES: DeviceDefinition[] = [
  {
    id: 'MOTOR-001',
    name: 'Main Drive Motor - Line A',
    type: 'motor',
    location: 'factory-floor-A',
    sensors: [
      { type: 'temperature', unit: 'celsius', normalMin: 40, normalMax: 75, absoluteMin: 15, absoluteMax: 150 },
      { type: 'vibration', unit: 'mm/s', normalMin: 0.5, normalMax: 4.5, absoluteMin: 0, absoluteMax: 50 },
      { type: 'rpm', unit: 'rpm', normalMin: 1400, normalMax: 1500, absoluteMin: 0, absoluteMax: 3000 },
    ],
    metadata: { manufacturer: 'Siemens', model: 'SIMOTICS GP 1LE0', serialNumber: 'SN-2026-001' },
  },
  {
    id: 'MOTOR-002',
    name: 'Auxiliary Motor - Line A',
    type: 'motor',
    location: 'factory-floor-A',
    sensors: [
      { type: 'temperature', unit: 'celsius', normalMin: 35, normalMax: 70, absoluteMin: 15, absoluteMax: 150 },
      { type: 'vibration', unit: 'mm/s', normalMin: 0.3, normalMax: 3.5, absoluteMin: 0, absoluteMax: 50 },
      { type: 'rpm', unit: 'rpm', normalMin: 1000, normalMax: 1100, absoluteMin: 0, absoluteMax: 2000 },
    ],
    metadata: { manufacturer: 'ABB', model: 'M3BP 132', serialNumber: 'SN-2026-002' },
  },
  {
    id: 'PUMP-001',
    name: 'Cooling Pump - Utility',
    type: 'pump',
    location: 'utility-room',
    sensors: [
      { type: 'temperature', unit: 'celsius', normalMin: 25, normalMax: 55, absoluteMin: 10, absoluteMax: 100 },
      { type: 'pressure', unit: 'psi', normalMin: 40, normalMax: 80, absoluteMin: 0, absoluteMax: 200 },
      { type: 'vibration', unit: 'mm/s', normalMin: 0.2, normalMax: 3.0, absoluteMin: 0, absoluteMax: 30 },
    ],
    metadata: { manufacturer: 'Grundfos', model: 'CR 32-2', serialNumber: 'SN-2026-003' },
  },
  {
    id: 'COMP-001',
    name: 'Air Compressor - Line B',
    type: 'compressor',
    location: 'factory-floor-B',
    sensors: [
      { type: 'temperature', unit: 'celsius', normalMin: 50, normalMax: 90, absoluteMin: 15, absoluteMax: 150 },
      { type: 'pressure', unit: 'psi', normalMin: 100, normalMax: 125, absoluteMin: 0, absoluteMax: 200 },
      { type: 'vibration', unit: 'mm/s', normalMin: 1.0, normalMax: 5.0, absoluteMin: 0, absoluteMax: 50 },
    ],
    metadata: { manufacturer: 'Atlas Copco', model: 'GA 30+', serialNumber: 'SN-2026-004' },
  },
  {
    id: 'CONV-001',
    name: 'Main Conveyor Belt - Line A',
    type: 'conveyor',
    location: 'factory-floor-A',
    sensors: [
      { type: 'temperature', unit: 'celsius', normalMin: 20, normalMax: 45, absoluteMin: 10, absoluteMax: 80 },
      { type: 'vibration', unit: 'mm/s', normalMin: 0.1, normalMax: 2.5, absoluteMin: 0, absoluteMax: 20 },
      { type: 'rpm', unit: 'rpm', normalMin: 50, normalMax: 60, absoluteMin: 0, absoluteMax: 120 },
    ],
    metadata: { manufacturer: 'Bosch Rexroth', model: 'VarioFlow plus', serialNumber: 'SN-2026-005' },
  },
];
