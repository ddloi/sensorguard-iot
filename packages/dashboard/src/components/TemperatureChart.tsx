import type { TimeSeriesPoint } from '../types/domain';
import { time } from '../utils/format';
export function TemperatureChart({
  data,
  deviceId,
}: {
  data: TimeSeriesPoint[];
  deviceId: string;
}) {
  // Timestamp-proportional positions preserve real gaps in telemetry.
  const values = data.flatMap((p) => [p.latest, p.movingAvg]).filter(Number.isFinite);
  const min =
    Math.floor((Math.min(...values, deviceId === 'MOTOR-001' ? 80 : Infinity) - 5) / 10) * 10;
  const max =
    Math.ceil((Math.max(...values, deviceId === 'MOTOR-001' ? 90 : -Infinity) + 5) / 10) * 10;
  const start = new Date(data[0].timestamp).getTime();
  const end = new Date(data[data.length - 1].timestamp).getTime();
  const y = (value: number) => 195 - ((value - min) / (max - min || 1)) * 175;
  const x = (p: TimeSeriesPoint) =>
    12 + ((new Date(p.timestamp).getTime() - start) / (end - start || 1)) * 720;
  const points = (key: 'latest' | 'movingAvg') => data.map((p) => `${x(p)},${y(p[key])}`).join(' ');
  return (
    <>
      <div className="chart-container">
        <div className="chart-plot">
          <svg
            viewBox="0 0 744 218"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Biểu đồ nhiệt độ ${deviceId}, từ ${time(data[0].timestamp)} đến ${time(data[data.length - 1].timestamp)}`}
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const value = min + ((max - min) * i) / 4;
              return (
                <line
                  key={i}
                  x1="12"
                  x2="732"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--chart-grid)"
                />
              );
            })}
            {deviceId === 'MOTOR-001' && (
              <line
                x1="12"
                x2="732"
                y1={y(85)}
                y2={y(85)}
                stroke="var(--accent-rose)"
                strokeDasharray="6 5"
              />
            )}
            <polyline
              points={points('latest')}
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <polyline
              points={points('movingAvg')}
              fill="none"
              stroke="var(--accent-cyan)"
              strokeWidth="2.5"
              strokeDasharray="8 4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="chart-ylabels" aria-hidden="true">
          {[4, 3, 2, 1, 0].map((i) => (
            <span key={i}>{(min + ((max - min) * i) / 4).toFixed(0)}°</span>
          ))}
        </div>
      </div>
      <div className="chart-axis">
        <span>{time(data[0].timestamp)}</span>
        <span>20 phút gần nhất · °C</span>
        <span>{time(data[data.length - 1].timestamp)}</span>
      </div>
    </>
  );
}
