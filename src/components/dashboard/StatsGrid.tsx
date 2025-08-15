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
  const averageDurationSeconds = stats?.averageDurationSeconds || 0;
  const completedCalls = stats?.completed || 0;
  const failedCalls = stats?.failed || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6 rounded-xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg">
            <Phone className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-blue-700 font-medium">Total Llamadas</p>
            <p className="text-xl md:text-2xl font-bold text-blue-900">{totalCalls}</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-4 md:p-6 rounded-xl shadow-lg border border-emerald-200 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-emerald-600 to-green-700 rounded-lg">
            <Clock className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-emerald-700 font-medium">Tiempo Promedio</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-900">{averageDuration}</p>
            <p className="text-xs text-emerald-600">({averageDurationSeconds} segundos)</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-violet-100 p-4 md:p-6 rounded-xl shadow-lg border border-purple-200 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-violet-700 rounded-lg">
            <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-purple-700 font-medium">Completadas</p>
            <p className="text-xl md:text-2xl font-bold text-purple-900">{completedCalls}</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-50 to-pink-100 p-4 md:p-6 rounded-xl shadow-lg border border-red-200 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-red-600 to-pink-700 rounded-lg">
            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-red-700 font-medium">Fallidas</p>
            <p className="text-xl md:text-2xl font-bold text-red-900">{failedCalls}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-amber-50 to-yellow-100 p-4 md:p-6 rounded-xl shadow-lg border border-amber-200 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-amber-600 to-yellow-700 rounded-lg">
            <Timer className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-amber-700 font-medium">Llamadas menores a 16s</p>
            <p className="text-xl md:text-2xl font-bold text-amber-900">{shortCalls}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-cyan-50 to-teal-100 p-4 md:p-6 rounded-xl shadow-lg border border-cyan-200 hover:shadow-xl transition-all duration-300 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-cyan-600 to-teal-700 rounded-lg">
            <Timer className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-cyan-700 font-medium">Llamadas mayores a 16s</p>
            <p className="text-xl md:text-2xl font-bold text-cyan-900">{longCalls}</p>
          </div>
        </div>
      </div>
    </div>
  );
}