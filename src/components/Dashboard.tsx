import React, { useState } from 'react';
import { useCallsContext } from '../context/CallsContext';

// Componente de indicador de carga con progreso
const LoadingIndicator = ({ progress, total }: { progress: number, total: number }) => {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  
  return (
    <div className="flex flex-col items-center mt-4">
      <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Cargando... {progress} llamadas ({percentage}%)
      </p>
    </div>
  );
};

// Componente de estado de caché
const CacheStatus = ({ lastUpdated }: { lastUpdated: number | null }) => {
  if (!lastUpdated) return null;
  
  const lastUpdateTime = new Date(lastUpdated).toLocaleTimeString();
  const lastUpdateDate = new Date(lastUpdated).toLocaleDateString();
  
  return (
    <div className="mt-2 text-sm text-gray-500">
      Datos actualizados: {lastUpdateDate} a las {lastUpdateTime}
    </div>
  );
};

export default function Dashboard() {
  const { 
    allCalls, 
    loadingAllCalls, 
    loadingProgress, 
    error, 
    totalCalls, 
    loadAllCalls,
    disconnectionReasons,
    lastUpdated
  } = useCallsContext();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Función para recargar los datos manualmente
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllCalls(true); // Forzar recarga ignorando la caché
    setIsRefreshing(false);
  };
  
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">uMindsAI Dashboard</h1>
        
        <button
          onClick={handleRefresh}
          disabled={loadingAllCalls || isRefreshing}
          className={`w-full md:w-auto px-4 py-2 rounded ${
            loadingAllCalls || isRefreshing 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {loadingAllCalls || isRefreshing ? 'Actualizando...' : 'Actualizar datos'}
        </button>
      </div>
      
      <CacheStatus lastUpdated={lastUpdated} />
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loadingAllCalls ? (
        <LoadingIndicator progress={loadingProgress} total={totalCalls || 1000} />
      ) : (
        <div className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {/* Tarjeta de total de llamadas */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
              <h2 className="text-lg md:text-xl font-semibold mb-2">Total de llamadas</h2>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">{totalCalls}</p>
            </div>
            
            {/* Tarjeta de razones de desconexión */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
              <h2 className="text-lg md:text-xl font-semibold mb-2">Razones de desconexión</h2>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">{disconnectionReasons.length}</p>
              <ul className="mt-4 text-xs md:text-sm text-gray-600 max-h-32 md:max-h-40 overflow-auto">
                {disconnectionReasons.map(reason => (
                  <li key={reason} className="mb-1">• {reason}</li>
                ))}
              </ul>
            </div>
            
            {/* Tarjeta de duración promedio */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
              <h2 className="text-lg md:text-xl font-semibold mb-2">Duración promedio</h2>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">
                {allCalls.length > 0 
                  ? (allCalls.reduce((acc, call) => 
                      acc + (call.duration || 0), 0) / allCalls.length).toFixed(1) + 's'
                  : 'N/A'}
              </p>
            </div>
          </div>
          
          {/* Aquí puedes añadir más elementos de visualización como gráficos, tablas, etc. */}
        </div>
      )}
    </div>
  );
} 