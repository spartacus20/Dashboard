import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { RetellCall } from '../../types';

// Registrar los componentes necesarios de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HourlyCallsChartProps {
  calls: RetellCall[];
}

export function HourlyCallsChart({ calls }: HourlyCallsChartProps) {
  // Procesar los datos para el gráfico
  const { hourlyData, totalLongCalls, avgDuration } = useMemo(() => {
    // Array para almacenar el conteo por hora (0-23)
    const hourCounts = Array(24).fill(0);
    let sumDuration = 0;
    let countValidCalls = 0;
    
    // Filtrar llamadas que duraron más de 16 segundos
    const longCalls = calls.filter(call => {
      // Usando casting a any para evitar errores de TypeScript
      const callAny = call as any;
      if (callAny.end_timestamp && callAny.start_timestamp) {
        const duration = callAny.end_timestamp - callAny.start_timestamp;
        if (duration >= 16000) { // 16 segundos en milisegundos
          sumDuration += duration;
          countValidCalls++;
          return true;
        }
      }
      return false;
    });
    
    // Contar las llamadas por hora
    longCalls.forEach(call => {
      // Obtener la hora de inicio de la llamada
      const startTimestamp = (call as any).start_timestamp;
      if (startTimestamp) {
        const date = new Date(startTimestamp);
        const hour = date.getHours();
        hourCounts[hour]++;
      }
    });
    
    // Calcular duración promedio en segundos (redondeado a 1 decimal)
    const avgDurationSeconds = countValidCalls > 0 
      ? Math.round((sumDuration / countValidCalls / 1000) * 10) / 10
      : 0;
    
    return { 
      hourlyData: hourCounts, 
      totalLongCalls: longCalls.length,
      avgDuration: avgDurationSeconds
    };
  }, [calls]);
  
  // Opciones para el gráfico
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Llamadas Largas (+16s) por Hora',
        color: '#fff'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.raw} llamadas largas`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af'
        },
        grid: {
          color: '#374151'
        }
      },
      y: {
        ticks: {
          color: '#9ca3af',
          precision: 0
        },
        grid: {
          color: '#374151'
        }
      }
    }
  };
  
  // Preparar los datos para el gráfico
  const chartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        data: hourlyData,
        backgroundColor: '#3b82f6',
        hoverBackgroundColor: '#2563eb',
        borderRadius: 6,
        maxBarThickness: 40
      }
    ],
  };

  return (
    <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <div className="mb-4 md:mb-0">
          <h3 className="text-lg font-semibold text-white">Llamadas Largas por Hora</h3>
          <p className="text-sm text-gray-400">Distribución horaria de llamadas de más de 16 segundos</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto">
          <div className="text-center px-3 py-1 bg-blue-900/30 rounded-md w-full md:w-auto">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-lg font-bold text-blue-400">{totalLongCalls}</p>
          </div>
          <div className="text-center px-3 py-1 bg-blue-900/30 rounded-md w-full md:w-auto">
            <p className="text-xs text-gray-400">Duración Promedio</p>
            <p className="text-lg font-bold text-blue-400">{avgDuration}s</p>
          </div>
        </div>
      </div>
      <div className="h-[300px] md:h-[350px]">
        <Bar options={options} data={chartData} />
      </div>
    </div>
  );
} 