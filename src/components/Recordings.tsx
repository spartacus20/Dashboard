import React, { useState, useMemo } from 'react';
import { useCallsContext } from '../context/CallsContext';
import { DetailedRetellCall, PaginationOptions } from '../types';

// Componente para mostrar una grabación individual
const RecordingItem = ({ call }: { call: DetailedRetellCall }) => {
  const startTime = call.start_time ? new Date(call.start_time).toLocaleString() : 'N/A';
  const duration = call.duration ? `${call.duration.toFixed(1)}s` : 'N/A';
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{call.call_id}</h3>
          <p className="text-sm text-gray-500">Inicio: {startTime}</p>
          <p className="text-sm text-gray-500">Duración: {duration}</p>
          {call.disconnection_reason && (
            <p className="text-sm text-gray-500">
              Razón de desconexión: {call.disconnection_reason}
            </p>
          )}
        </div>
        
        {call.recording_url && (
          <a 
            href={call.recording_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
          >
            Escuchar grabación
          </a>
        )}
      </div>
    </div>
  );
};

// Componente de paginación
const Pagination = ({ 
  total, 
  options, 
  setOptions 
}: { 
  total: number; 
  options: PaginationOptions; 
  setOptions: (options: PaginationOptions) => void;
}) => {
  const totalPages = Math.ceil(total / options.pageSize);
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setOptions({ ...options, page: newPage });
    }
  };
  
  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(event.target.value);
    setOptions({ page: 1, pageSize: newPageSize });
  };
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4">
      <div className="mb-4 sm:mb-0">
        <span className="mr-2">Registros por página:</span>
        <select 
          value={options.pageSize} 
          onChange={handlePageSizeChange}
          className="border rounded p-1"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      
      <div className="flex items-center">
        <button 
          onClick={() => handlePageChange(options.page - 1)}
          disabled={options.page <= 1}
          className="px-3 py-1 rounded border mr-2 disabled:opacity-50"
        >
          Anterior
        </button>
        
        <span className="mx-2">
          Página {options.page} de {totalPages}
        </span>
        
        <button 
          onClick={() => handlePageChange(options.page + 1)}
          disabled={options.page >= totalPages}
          className="px-3 py-1 rounded border ml-2 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default function Recordings() {
  const { 
    allCalls, 
    loadingAllCalls, 
    error,
    totalCalls,
    loadAllCalls, 
    lastUpdated 
  } = useCallsContext();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paginationOptions, setPaginationOptions] = useState<PaginationOptions>({
    page: 1,
    pageSize: 25
  });
  
  // Calcular las llamadas paginadas
  const paginatedCalls = useMemo(() => {
    const startIndex = (paginationOptions.page - 1) * paginationOptions.pageSize;
    const endIndex = startIndex + paginationOptions.pageSize;
    return allCalls.slice(startIndex, endIndex);
  }, [allCalls, paginationOptions.page, paginationOptions.pageSize]);
  
  // Función para recargar los datos manualmente
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllCalls(true); // Forzar recarga ignorando la caché
    setIsRefreshing(false);
  };
  
  // Mostrar hora de última actualización
  const getLastUpdatedMessage = () => {
    if (!lastUpdated) return null;
    const time = new Date(lastUpdated).toLocaleTimeString();
    const date = new Date(lastUpdated).toLocaleDateString();
    return `Datos actualizados: ${date} a las ${time}`;
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Grabaciones</h1>
        
        <button
          onClick={handleRefresh}
          disabled={loadingAllCalls || isRefreshing}
          className={`px-4 py-2 rounded ${
            loadingAllCalls || isRefreshing 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {loadingAllCalls || isRefreshing ? 'Actualizando...' : 'Actualizar datos'}
        </button>
      </div>
      
      {lastUpdated && (
        <p className="text-sm text-gray-500 mb-4">{getLastUpdatedMessage()}</p>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loadingAllCalls ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
          <p>Cargando grabaciones...</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-gray-600">
              Mostrando {paginatedCalls.length} de {totalCalls} grabaciones
            </p>
          </div>
          
          {paginatedCalls.length > 0 ? (
            <div className="space-y-4">
              {paginatedCalls.map(call => (
                <RecordingItem key={call.call_id} call={call} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No hay grabaciones disponibles</p>
            </div>
          )}
          
          <Pagination 
            total={totalCalls} 
            options={paginationOptions} 
            setOptions={setPaginationOptions} 
          />
        </>
      )}
    </div>
  );
} 