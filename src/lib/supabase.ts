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
      const data = await response.json()
      const clientId = data.client_id || data.clientId
      
      if (clientId) {
        // Guardar en localStorage
        setClientId(clientId)
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
