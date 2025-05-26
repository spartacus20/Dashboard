import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { RetellCall } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PeakTimesChartProps {
  calls: RetellCall[];
}

export function PeakTimesChart({ calls }: PeakTimesChartProps) {
  const hourlyData = React.useMemo(() => {
    const hours = Array(24).fill(0);
    
    calls.forEach(call => {
      const hour = new Date(call.start_timestamp).getHours();
      hours[hour]++;
    });
    
    return hours;
  }, [calls]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Distribución de Llamadas por Hora',
        color: '#fff',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#9ca3af',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          title: (items: any[]) => {
            const hour = parseInt(items[0].label);
            return `${hour}:00 - ${hour + 1}:00`;
          },
          label: (context: any) => {
            return `${context.raw} llamadas`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          color: '#374151'
        },
        ticks: {
          color: '#9ca3af',
          callback: (value: number) => `${value}:00`
        },
        border: {
          color: '#374151'
        }
      },
      y: {
        grid: {
          color: '#374151'
        },
        ticks: {
          color: '#9ca3af'
        },
        border: {
          color: '#374151'
        }
      }
    }
  };

  const data = {
    labels: Array.from({ length: 24 }, (_, i) => i),
    datasets: [
      {
        data: hourlyData,
        backgroundColor: '#8b5cf6',
        hoverBackgroundColor: '#7c3aed',
        borderRadius: 6,
        maxBarThickness: 40
      }
    ]
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-800">
      <div className="h-[400px]">
        <Bar options={options} data={data} />
      </div>
    </div>
  );
}