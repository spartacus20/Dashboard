import React from 'react';
import type { RetellCall } from '../../types';

interface CallsTableContentProps {
  calls: RetellCall[];
  loading: boolean;
  error: string | null;
  paginationKey?: string;
  onLoadMore: () => void;
}

export function CallsTableContent({
  calls,
  loading,
  error,
  paginationKey,
  onLoadMore,
}: CallsTableContentProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha y Hora
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID de Llamada
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duración
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Agente
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {loading && (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                Cargando llamadas...
              </td>
            </tr>
          )}
          {error && (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-red-400">
                {error}
              </td>
            </tr>
          )}
          {!loading && !error && calls.map((call) => {
            const duration = call.end_timestamp && call.start_timestamp
              ? new Date(call.end_timestamp - call.start_timestamp).toISOString().substr(11, 8)
              : '-';
            
            return (
              <tr key={call.call_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {new Date(call.start_timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {call.call_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {duration}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {call.agent_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      call.call_status === 'ended'
                        ? 'bg-green-900/50 text-green-400'
                        : call.call_status === 'error'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-yellow-900/50 text-yellow-400'
                    }`}
                  >
                    {call.call_status === 'ended' ? 'Completada' : 
                     call.call_status === 'error' ? 'Fallida' : 
                     call.call_status === 'ongoing' ? 'En Curso' : 'Registrada'}
                  </span>
                </td>
              </tr>
            );
          })}
          {!loading && !error && calls.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                No se encontraron llamadas
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {paginationKey && !loading && !error && (
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onLoadMore}
            className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cargar más llamadas
          </button>
        </div>
      )}
    </div>
  );
}