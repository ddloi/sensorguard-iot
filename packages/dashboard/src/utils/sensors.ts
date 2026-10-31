export const sensorInfo: Record<string, { label: string; unit: string; min: number; max: number }> =
  {
    temperature: { label: 'Nhiệt độ', unit: '°C', min: 0, max: 150 },
    vibration: { label: 'Độ rung', unit: 'mm/s', min: 0, max: 15 },
    rpm: { label: 'Tốc độ quay', unit: 'rpm', min: 0, max: 3600 },
    pressure: { label: 'Áp suất', unit: 'psi', min: 0, max: 200 },
    power: { label: 'Công suất', unit: 'kW', min: 0, max: 100 },
  };
