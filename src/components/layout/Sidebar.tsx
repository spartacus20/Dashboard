import React, { useEffect, useState } from 'react';
import { BarChart3, Mic, Menu, X, Key, Phone, PhoneOutgoing } from 'lucide-react';
import { useCallsContext } from '../../context/CallsContext';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  cacheStatus?: string;
  isLoading?: boolean;
}

export function Sidebar({ currentPage, onPageChange, cacheStatus, isLoading }: SidebarProps) {
  const { loadingProgress, totalCalls, loadingAllCalls, apiKey } = useCallsContext();
  const progressPercentage = totalCalls > 0 ? Math.min(100, Math.round((loadingProgress / totalCalls) * 100)) : 0;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showBatchCall, setShowBatchCall] = useState(false);
  
  // Verificar si debemos mostrar Batch Call basado en parámetros URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callType = params.get('call');
    setShowBatchCall(callType === 'outbound');
  }, []);
  
  // Función para mantener los parámetros URL al cambiar de página
  const navigateWithParams = (page: string) => {
    // Obtener y mantener los parámetros URL actuales
    const currentUrl = new URL(window.location.href);
    const searchParams = currentUrl.searchParams;
    
    // Crear un objeto con todos los parámetros actuales
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    // Cambiar la página pero conservar los parámetros de URL
    onPageChange(page);
    setIsMobileMenuOpen(false);
    
    // Actualizar la URL con los parámetros pero sin recargar la página
    const newUrl = new URL(window.location.origin + window.location.pathname);
    Object.entries(params).forEach(([key, value]) => {
      newUrl.searchParams.append(key, value);
    });
    window.history.pushState({}, '', newUrl.toString());
  };
  
  // Truncar la API key para mostrarla de forma segura
  const truncatedApiKey = apiKey 
    ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` 
    : 'No configurada';
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return (
    <>
      {/* Botón de menú móvil (visible solo en pantallas pequeñas) */}
      <button 
        onClick={toggleMobileMenu}
        className="fixed top-4 left-4 z-50 p-2 bg-gray-900 rounded-md shadow-md md:hidden"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>
      
      {/* Overlay para cerrar el menú en móvil al tocar fuera */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleMobileMenu}
        ></div>
      )}
      
      <div className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 p-4 z-40 transition-transform duration-300 ease-in-out transform ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-white">uMindsAI Dashboard</h1>
        </div>
        
        {/* Indicador de API key en uso */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-gray-800 rounded-md text-xs text-gray-300">
          <Key className="w-4 h-4 text-purple-400" />
          <div className="overflow-hidden text-ellipsis">
            <span className="text-gray-500">API Key:</span> {truncatedApiKey}
          </div>
        </div>
        
        {/* Indicador de estado de caché */}
        {cacheStatus && (
          <div className="mt-2 text-xs text-gray-400 mb-4">
            {isLoading || loadingAllCalls ? (
              <div className="space-y-2">
                <span className="flex items-center text-blue-400">
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cargando datos...
                </span>
                
                {/* Barra de progreso */}
                {loadingProgress > 0 && (
                  <div className="w-full">
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>{loadingProgress} llamadas</span>
                      {totalCalls > 0 && <span>{progressPercentage}%</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              cacheStatus
            )}
          </div>
        )}
        
        <nav className="space-y-2">
          <button
            onClick={() => {
              navigateWithParams('dashboard');
            }}
            className={`flex w-full items-center gap-2 px-4 py-2 ${
              currentPage === 'dashboard'
                ? 'text-purple-400 bg-gray-800'
                : 'text-gray-400 hover:bg-gray-800'
            } rounded-lg`}
          >
            <BarChart3 className="w-5 h-5" />
            Dashboard
          </button>
          <button
            onClick={() => {
              navigateWithParams('recordings');
            }}
            className={`flex w-full items-center gap-2 px-4 py-2 ${
              currentPage === 'recordings'
                ? 'text-purple-400 bg-gray-800'
                : 'text-gray-400 hover:bg-gray-800'
            } rounded-lg`}
          >
            <Mic className="w-5 h-5" />
            Grabaciones
          </button>
          <button
            onClick={() => {
              navigateWithParams('phones');
            }}
            className={`flex w-full items-center gap-2 px-4 py-2 ${
              currentPage === 'phones'
                ? 'text-purple-400 bg-gray-800'
                : 'text-gray-400 hover:bg-gray-800'
            } rounded-lg`}
          >
            <Phone className="w-5 h-5" />
            Números de Teléfono
          </button>
          {showBatchCall && (
            <button
              onClick={() => {
                navigateWithParams('batch-call');
              }}
              className={`flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === 'batch-call'
                  ? 'text-purple-400 bg-gray-800'
                  : 'text-gray-400 hover:bg-gray-800'
              } rounded-lg`}
            >
              <PhoneOutgoing className="w-5 h-5" />
              Llamadas en Lote
            </button>
          )}
        </nav>
      </div>
    </>
  );
}