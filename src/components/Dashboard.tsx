import React, { useState } from 'react';
import { useCallsContext } from '../context/CallsContext';

// Componente de indicador de carga con progreso
const LoadingIndicator = ({ progress, total }: { progress: number, total: number }) => {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  
  return (
    <div className="flex flex-col items-center mt-8 p-8 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200 shadow-sm">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mb-4">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
      <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">Cargando datos...</h3>
      <div className="w-full max-w-md bg-blue-100 rounded-full h-3 mb-3">
        <div 
          className="bg-gradient-to-r from-blue-600 to-indigo-700 h-3 rounded-full transition-all duration-300" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="text-sm text-blue-700">
        {progress} de {total} llamadas ({percentage}%)
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
            <div className="mt-3 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 inline-block">
      <span className="text-blue-700 font-medium">Última actualización:</span> {lastUpdateDate} a las {lastUpdateTime}
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
    <div className="p-4 md:p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header del Dashboard */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-2">uMindsAI Dashboard</h1>
            <p className="text-slate-600">Panel de control y análisis de llamadas</p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loadingAllCalls || isRefreshing}
            className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
              loadingAllCalls || isRefreshing 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}
          >
            {loadingAllCalls || isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Actualizando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar datos
              </>
            )}
          </button>
        </div>
        
        <CacheStatus lastUpdated={lastUpdated} />
      </div>
      
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-pink-100 border border-red-300 text-red-900 px-6 py-4 rounded-xl mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}
      
      {loadingAllCalls ? (
        <LoadingIndicator progress={loadingProgress} total={totalCalls || 1000} />
      ) : (
        <div className="space-y-8">
          {/* Sección de estadísticas principales */}
          <div>
            <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-indigo-700 rounded-full"></div>
              Estadísticas Principales
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {/* Tarjeta de total de llamadas */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-blue-600 uppercase tracking-wide font-medium">Total</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Llamadas</h3>
                <p className="text-3xl font-bold text-blue-900">{totalCalls.toLocaleString()}</p>
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center text-sm text-blue-700">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Registros completos
                  </div>
                </div>
              </div>
              
              {/* Tarjeta de razones de desconexión */}
              <div className="bg-gradient-to-br from-red-50 to-pink-100 p-6 rounded-xl shadow-lg border border-red-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-pink-700 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-red-600 uppercase tracking-wide font-medium">Tipos</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">Razones de desconexión</h3>
                <p className="text-3xl font-bold text-red-900">{disconnectionReasons.length}</p>
                <div className="mt-4 pt-4 border-t border-red-200">
                  <div className="text-sm text-red-700">
                    {disconnectionReasons.length > 0 ? (
                      <div className="max-h-20 overflow-y-auto">
                        {disconnectionReasons.slice(0, 3).map((reason, index) => (
                          <div key={index} className="flex items-center text-xs mb-1">
                            <div className="w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                            {reason.length > 25 ? reason.substring(0, 25) + '...' : reason}
                          </div>
                        ))}
                        {disconnectionReasons.length > 3 && (
                          <div className="text-xs text-red-600 mt-1">
                            +{disconnectionReasons.length - 3} más
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-red-600">Sin datos</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Tarjeta de duración promedio */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-6 rounded-xl shadow-lg border border-emerald-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-700 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Promedio</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-emerald-900 mb-2">Duración</h3>
                <p className="text-3xl font-bold text-emerald-900">
                  {allCalls.length > 0 
                    ? (allCalls.reduce((acc, call) => 
                        acc + (call.duration || 0), 0) / allCalls.length).toFixed(1) + 's'
                    : 'N/A'}
                </p>
                <div className="mt-4 pt-4 border-t border-emerald-200">
                  <div className="flex items-center text-sm text-emerald-700">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Tiempo promedio
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sección de información adicional */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200">
            <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Información del Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>Total de registros cargados: <strong className="text-blue-900">{allCalls.length}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>Última actualización: <strong className="text-blue-900">{lastUpdated ? new Date(lastUpdated).toLocaleString() : 'N/A'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 