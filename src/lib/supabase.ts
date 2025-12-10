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

// Obtener la URL base según el entorno
export const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION_API === 'true';
const BASE_PROD = import.meta.env.VITE_BASE_PROD;
const BASE_DEV = import.meta.env.VITE_BASE_DEV;
export const BASE_URL = IS_PRODUCTION ? BASE_PROD : BASE_DEV;

const GET_CLIENT_WEBHOOK_URL = `${BASE_URL}/get-client`

// Función para obtener el client_id de get-client usando el endpoint local
export const getClientId = async (email: string): Promise<string | null> => {
  try {
    // Mostrar la URL base al cargar get-client
    console.log('🌐 BASE_URL:', BASE_URL)
    // Siempre hacer la petición para obtener datos actualizados (incluyendo permissions)
    console.log('🔍 Obteniendo datos del usuario desde:', GET_CLIENT_WEBHOOK_URL)
    
    // Hacer petición POST al endpoint correcto
    const response = await fetch(GET_CLIENT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    })

    if (response.ok) {
      const data = await response.json()
      
      // El endpoint puede devolver un array o un objeto directamente
      let userData: any
      if (Array.isArray(data) && data.length > 0) {
        userData = data[0]
      } else if (data && typeof data === 'object') {
        userData = data
      } else {
        console.warn('Formato de respuesta inesperado:', data)
        return null
      }
      
      // Normalizar los nombres de campos (el backend puede devolver clientId o client_id)
      const clientId = userData.clientId || userData.client_id
      const apiKey = userData.apiKey || userData.api_key
      const fullName = userData.fullName || userData.full_name || ''
      
      if (clientId) {
        // Guardar en localStorage (compatibilidad hacia atrás)
        setClientId(clientId)
        
        // Guardar TODOS los datos en sessionStorage
        sessionStorage.setItem('userData', JSON.stringify(userData))
        if (apiKey) {
          sessionStorage.setItem('apiKey', apiKey)
        }
        sessionStorage.setItem('clientId', clientId)
        if (userData.email) {
          sessionStorage.setItem('email', userData.email)
        }
        sessionStorage.setItem('fullName', fullName)
        
        // Guardar metadatos
        if (userData.metadata) {
          sessionStorage.setItem('metadata', JSON.stringify(userData.metadata))
          // Disparar evento personalizado para notificar que el metadata se guardó
          window.dispatchEvent(new CustomEvent('metadataUpdated', { 
            detail: { metadata: userData.metadata } 
          }))
        }
        
        // Guardar metadata_llamadas
        if (userData.metadata_llamadas) {
          sessionStorage.setItem('metadata_llamadas', JSON.stringify(userData.metadata_llamadas))
        }
        
        // Guardar permissions SOLO si no existen ya en sessionStorage (evitar sobrescribir en refresh)
        // Esto previene problemas de seguridad donde se muestran páginas que el usuario no debería ver
        const existingPermissions = sessionStorage.getItem('permissions')
        if (!existingPermissions) {
          // Solo actualizar si no existen permissions previos
          if (userData.permissions && typeof userData.permissions === 'object') {
            const permissionsKeys = Object.keys(userData.permissions)
            if (permissionsKeys.length > 0) {
              // Si tiene al menos una propiedad, guardarlo
              sessionStorage.setItem('permissions', JSON.stringify(userData.permissions))
              console.log('✅ Permissions guardados:', userData.permissions)
            } else {
              // Si es un objeto vacío, no guardar nada (o guardar null para indicar que no hay permissions)
              sessionStorage.removeItem('permissions')
              console.log('ℹ️ Permissions vacío del servidor, usuario sin limitaciones')
            }
          } else if (userData.permissions === null || userData.permissions === undefined) {
            // Si es null o undefined, no guardar nada
            sessionStorage.removeItem('permissions')
            console.log('ℹ️ No hay permissions definidos, usuario sin limitaciones')
          } else {
            // Cualquier otro caso, guardar como está
            sessionStorage.setItem('permissions', JSON.stringify(userData.permissions))
            console.log('✅ Permissions guardados (formato no estándar):', userData.permissions)
          }
        } else {
          console.log('ℹ️ Permissions ya existen en sessionStorage, no se sobrescriben para evitar problemas de seguridad')
        }
        
        console.log('✅ Datos del usuario guardados en sessionStorage:', {
          clientId: clientId,
          email: userData.email,
          fullName: fullName,
          hasMetadata: !!userData.metadata,
          hasMetadataLlamadas: !!userData.metadata_llamadas,
          hasPermissions: !!userData.permissions,
          permissions: userData.permissions
        })
        
        return clientId
      }
    } else {
      const errorText = await response.text()
      console.error('Error en la respuesta del servidor:', response.status, errorText)
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
  const parsedMetadata = metadata ? JSON.parse(metadata) : null
  console.log('📋 Obteniendo metadatos:', {
    rawMetadata: metadata,
    parsedMetadata
  })
  return parsedMetadata
}

export const getMetadataLlamadas = () => {
  const metadata_llamadas = sessionStorage.getItem('metadata_llamadas')
  return metadata_llamadas ? JSON.parse(metadata_llamadas) : null
}

export const getPermissions = () => {
  const permissions = sessionStorage.getItem('permissions')
  return permissions ? JSON.parse(permissions) : null
}

// Función para verificar si el usuario tiene permissions definidos (no vacío)
export const hasPermissionsDefined = (): boolean => {
  const permissions = getPermissions()
  // Si permissions es null o undefined, no hay permissions definidos
  if (!permissions) {
    return false
  }
  // Si no es un objeto, no es válido
  if (typeof permissions !== 'object') {
    return false
  }
  // Verificar si tiene al menos una propiedad con valor
  const keys = Object.keys(permissions)
  return keys.length > 0
}

// Función para verificar si el usuario tiene acceso a una funcionalidad específica
// Si tiene permissions definidos, usa permissions. Si no, permite todo (sin limitaciones)
export const canAccess = (feature: 'agenda' | 'records' | 'num_tel' | 'callbacks' | 'sales' | 'launch' | 'dont_call'): boolean => {
  const permissions = getPermissions()
  
  // Si no hay permissions definidos (o está vacío), permitir acceso (sin limitaciones)
  if (!hasPermissionsDefined()) {
    return true
  }
  
  // Si hay permissions definidos, verificar el permiso específico
  return permissions[feature] === true
}

// Función para verificar si el usuario tiene permisos de lanzamiento (compatibilidad hacia atrás)
export const hasLaunchPermissions = (): boolean => {
  // Primero verificar permissions
  if (hasPermissionsDefined()) {
    return canAccess('launch')
  }
  
  // Si no hay permissions, usar metadata (comportamiento anterior)
  const metadata = getMetadata()
  console.log('🔍 Verificando permisos de lanzamiento:', {
    metadata,
    hasLaunch: metadata?.launch === true
  })
  return metadata?.launch === true
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
  sessionStorage.removeItem('permissions')
  console.log('🧹 Datos del sessionStorage limpiados')
}
