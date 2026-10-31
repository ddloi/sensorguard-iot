import type { SensorValue } from '../types/domain';
import { sensorInfo } from '../utils/sensors';
export function RadialGauge({ sensor }: { sensor: SensorValue }) {
  const info = sensorInfo[sensor.type] || { label: sensor.type, unit: '', min: 0, max: 100 };
  const progress = Math.max(0, Math.min(1, (sensor.last - info.min) / (info.max - info.min)));
  return (
    <div className="gauge-item">
      <svg
        width="124"
        height="112"
        viewBox="0 0 124 112"
        role="img"
        aria-label={`${info.label}: ${sensor.last.toFixed(1)} ${info.unit}`}
      >
        <path
          d="M 25 91 A 52 52 0 1 1 99 91"
          fill="none"
          stroke="var(--bg-gauge-track)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 25 91 A 52 52 0 1 1 99 91"
          pathLength="100"
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${progress * 100} 100`}
        />
        <text
          x="62"
          y="56"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="23"
          fontWeight="650"
          fontFamily="var(--font-mono)"
        >
          {sensor.last.toFixed(sensor.type === 'rpm' ? 0 : 1)}
        </text>
        <text x="62" y="77" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">
          {info.unit}
        </text>
      </svg>
      <span className="gauge-item__label">{info.label}</span>
    </div>
  );
}
