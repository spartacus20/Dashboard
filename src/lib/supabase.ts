import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Configuración de Get-Client
export const GET_CLIENT_CONFIG = {
  apiUrl: import.meta.env.VITE_GET_CLIENT_API_URL || 'https://api.get-client.com',
  clientId: import.meta.env.VITE_GET_CLIENT_CLIENT_ID || 'your_client_id_here'
}

// Variable para la clave del localStorage
export const get_client_id = 'get_client_id'

// Función para obtener el client_id de get-client usando el endpoint local
export const getClientId = async (email: string): Promise<string | null> => {
  try {
    // Si ya tenemos el client_id almacenado, lo devolvemos
    const storedClientId = getStoredClientId()
    if (storedClientId) {
      return storedClientId
    }

    // Hacer petición POST al endpoint público
    const response = await fetch('https://api.iacreatorhub.com/get-client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    })

    if (response.ok) {
      const userData = await response.json()
      const clientId = userData.clientId
      
      if (clientId) {
        // Guardar en localStorage (compatibilidad hacia atrás)
        setClientId(clientId)
        
        // Guardar TODOS los datos en sessionStorage
        sessionStorage.setItem('userData', JSON.stringify(userData))
        sessionStorage.setItem('apiKey', userData.apiKey)
        sessionStorage.setItem('clientId', userData.clientId)
        sessionStorage.setItem('email', userData.email)
        sessionStorage.setItem('fullName', userData.fullName || '')
        
        // Guardar metadatos
        if (userData.metadata) {
          sessionStorage.setItem('metadata', JSON.stringify(userData.metadata))
        }
        
        // Guardar metadata_llamadas
        if (userData.metadata_llamadas) {
          sessionStorage.setItem('metadata_llamadas', JSON.stringify(userData.metadata_llamadas))
        }
        
        console.log('✅ Datos del usuario guardados en sessionStorage:', {
          clientId: userData.clientId,
          email: userData.email,
          fullName: userData.fullName,
          hasMetadata: !!userData.metadata,
          hasMetadataLlamadas: !!userData.metadata_llamadas
        })
        
        return clientId
      }
    }

    // Si no se puede obtener de la API, devolvemos null
    console.warn('No se pudo obtener el client_id de get-client')
    return null
  } catch (error) {
    console.error('Error obteniendo client_id:', error)
    return null
  }
}

// Función para configurar el client_id
export const setClientId = (clientId: string) => {
  // En un entorno de producción, esto debería guardarse en una base de datos
  // o en variables de entorno seguras
  localStorage.setItem(get_client_id, clientId)
}

// Función para obtener el client_id desde localStorage
export const getStoredClientId = (): string | null => {
  return localStorage.getItem(get_client_id)
}

// Funciones helper para acceder a los datos del sessionStorage
export const getUserData = () => {
  const userData = sessionStorage.getItem('userData')
  return userData ? JSON.parse(userData) : null
}

export const getApiKey = (): string | null => {
  return sessionStorage.getItem('apiKey')
}

export const getClientIdFromSession = (): string | null => {
  return sessionStorage.getItem('clientId')
}

export const getEmail = (): string | null => {
  return sessionStorage.getItem('email')
}

export const getFullName = (): string | null => {
  return sessionStorage.getItem('fullName')
}

export const getMetadata = () => {
  const metadata = sessionStorage.getItem('metadata')
  return metadata ? JSON.parse(metadata) : null
}

export const getMetadataLlamadas = () => {
  const metadata_llamadas = sessionStorage.getItem('metadata_llamadas')
  return metadata_llamadas ? JSON.parse(metadata_llamadas) : null
}

// Función para limpiar todos los datos del sessionStorage
export const clearSessionData = () => {
  sessionStorage.removeItem('userData')
  sessionStorage.removeItem('apiKey')
  sessionStorage.removeItem('clientId')
  sessionStorage.removeItem('email')
  sessionStorage.removeItem('fullName')
  sessionStorage.removeItem('metadata')
  sessionStorage.removeItem('metadata_llamadas')
  console.log('🧹 Datos del sessionStorage limpiados')
}
