import React from 'react';
import { Phone, Clock, UserCheck, AlertTriangle, Timer } from 'lucide-react';
import type { CallStats } from '../../types';

interface StatsGridProps {
  stats: CallStats | null;
  shortCalls: number;
  longCalls: number;
}

export function StatsGrid({ stats, shortCalls, longCalls }: StatsGridProps) {
  // Valores predeterminados si stats es null
  const totalCalls = stats?.total || 0;
  const averageDuration = stats?.averageDuration || '0:00';
  const completedCalls = stats?.completed || 0;
  const failedCalls = stats?.failed || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
      <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-green-900/50 rounded-lg">
            <Phone className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Total Llamadas</p>
            <p className="text-xl md:text-2xl font-bold text-white">{totalCalls}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-900/50 rounded-lg">
            <Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Tiempo Promedio</p>
            <p className="text-xl md:text-2xl font-bold text-white">{averageDuration}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-purple-900/50 rounded-lg">
            <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Completadas</p>
            <p className="text-xl md:text-2xl font-bold text-white">{completedCalls}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-red-900/50 rounded-lg">
            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Fallidas</p>
            <p className="text-xl md:text-2xl font-bold text-white">{failedCalls}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-yellow-900/50 rounded-lg">
            <Timer className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Llamadas menores a 16s</p>
            <p className="text-xl md:text-2xl font-bold text-white">{shortCalls}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 md:p-6 rounded-xl shadow-lg border border-gray-800 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-900/50 rounded-lg">
            <Timer className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Llamadas mayores a 16s</p>
            <p className="text-xl md:text-2xl font-bold text-white">{longCalls}</p>
          </div>
        </div>
      </div>
    </div>
  );
}