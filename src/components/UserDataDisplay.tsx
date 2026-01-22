import React from 'react'
import { useUserData } from '../hooks/useUserData'

const UserDataDisplay: React.FC = () => {
  const { 
    userData, 
    loading, 
    apiKey, 
    apiKeyTest,
    clientId, 
    email, 
    fullName, 
    metadata, 
    metadata_llamadas 
  } = useUserData()

  if (loading) {
    return <div>Cargando datos del usuario...</div>
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Datos del Usuario (SessionStorage)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Información básica */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Información Básica</h3>
          <p><strong>Email:</strong> {email || 'No disponible'}</p>
          <p><strong>Nombre:</strong> {fullName || 'No disponible'}</p>
          <p><strong>Client ID:</strong> {clientId || 'No disponible'}</p>
          <div>
            <strong>API Key:</strong>
            {apiKeyTest && apiKeyTest.length > 0 ? (
              <div className="mt-1 ml-4">
                <p className="text-sm text-gray-600">API Keys de prueba ({apiKeyTest.length}):</p>
                <ul className="list-disc list-inside text-xs text-gray-500">
                  {apiKeyTest.map((key, index) => (
                    <li key={index}>{key.substring(0, 10)}...</li>
                  ))}
                </ul>
              </div>
            ) : apiKey ? (
              <span className="ml-2">{apiKey.substring(0, 10)}...</span>
            ) : (
              <span className="ml-2 text-red-500">No configurada</span>
            )}
          </div>
        </div>

        {/* Metadata general */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Metadata General</h3>
          {metadata ? (
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          ) : (
            <p>No hay metadata disponible</p>
          )}
        </div>

        {/* Metadata de llamadas */}
        <div className="bg-white p-4 rounded shadow md:col-span-2">
          <h3 className="font-semibold mb-2">Metadata de Llamadas</h3>
          {metadata_llamadas ? (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-600">Total Llamadas</p>
                  <p className="text-xl font-bold text-blue-800">
                    {metadata_llamadas.total_llamadas || 0}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-sm text-green-600">Llamadas Exitosas</p>
                  <p className="text-xl font-bold text-green-800">
                    {metadata_llamadas.llamadas_exitosas || 0}
                  </p>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="text-sm text-yellow-600">Duración Promedio</p>
                  <p className="text-xl font-bold text-yellow-800">
                    {metadata_llamadas.duracion_promedio || 0}s
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <p className="text-sm text-purple-600">Última Llamada</p>
                  <p className="text-sm font-bold text-purple-800">
                    {metadata_llamadas.ultima_llamada ? 
                      new Date(metadata_llamadas.ultima_llamada).toLocaleDateString() : 
                      'N/A'
                    }
                  </p>
                </div>
              </div>
              
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                  Ver metadata completo
                </summary>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto mt-2">
                  {JSON.stringify(metadata_llamadas, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p>No hay metadata de llamadas disponible</p>
          )}
        </div>
      </div>

      {/* Debug info */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Debug: Ver todos los datos del sessionStorage
        </summary>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto mt-2">
          {JSON.stringify(userData, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default UserDataDisplay
