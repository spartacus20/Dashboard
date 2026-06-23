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
// Clave para el client_id seleccionado por el usuario (persistente)
export const selected_client_id = 'selected_client_id'

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
    // console.log('🌐 BASE_URL:', BASE_URL)
    // Siempre hacer la petición para obtener datos actualizados (incluyendo permissions)
    // console.log('🔍 Obteniendo datos del usuario desde:', GET_CLIENT_WEBHOOK_URL)
    
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
        // console.warn('Formato de respuesta inesperado:', data)
        return null
      }
      
      // Normalizar los nombres de campos (el backend puede devolver clientId o client_id)
      const defaultClientId = userData.clientId || userData.client_id
      const apiKey = userData.apiKey || userData.api_key
      const fullName = userData.fullName || userData.full_name || ''
      
      if (defaultClientId) {
        // Verificar si hay un client_id seleccionado por el usuario
        const selectedClientId = localStorage.getItem(selected_client_id)
        const clientTest = userData.client_test ? (typeof userData.client_test === 'string' ? JSON.parse(userData.client_test) : userData.client_test) : null
        
        // Determinar qué client_id usar:
        // 1. Si hay un client_id seleccionado Y está en la lista de client_test, usarlo
        // 2. Si no, usar el client_id por defecto del usuario
        let clientIdToUse = defaultClientId
        
        if (selectedClientId && clientTest) {
          // Verificar si el client_id seleccionado está en la lista permitida
          let allowedClientIds: string[] = []
          if (Array.isArray(clientTest)) {
            allowedClientIds = clientTest
          } else if (typeof clientTest === 'object' && clientTest !== null) {
            allowedClientIds = Object.values(clientTest).filter((v): v is string => typeof v === 'string')
          }
          
          // También agregar el client_id por defecto a la lista permitida
          if (!allowedClientIds.includes(defaultClientId)) {
            allowedClientIds.push(defaultClientId)
          }
          
          if (allowedClientIds.includes(selectedClientId)) {
            clientIdToUse = selectedClientId
            // console.log('✅ Usando client_id seleccionado por el usuario:', selectedClientId)
          } else {
            // console.log('⚠️ El client_id seleccionado no está en la lista permitida, usando el por defecto')
            // Limpiar el client_id seleccionado si no es válido
            localStorage.removeItem(selected_client_id)
          }
        } else {
          // console.log('ℹ️ No hay client_id seleccionado o no hay client_test, usando el por defecto:', defaultClientId)
        }
        
        // Guardar el client_id que vamos a usar (puede ser el seleccionado o el por defecto)
        setClientId(clientIdToUse)
        
        // Guardar TODOS los datos en sessionStorage
        sessionStorage.setItem('userData', JSON.stringify(userData))
        if (apiKey) {
          sessionStorage.setItem('apiKey', apiKey)
        }
        sessionStorage.setItem('clientId', clientIdToUse)
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

        // Guardar estado de suscripción del cliente
        sessionStorage.setItem('clientActive', String(userData.active !== false))
        if (userData.subscription_expires_at) {
          sessionStorage.setItem('subscriptionExpiresAt', userData.subscription_expires_at)
        } else {
          sessionStorage.removeItem('subscriptionExpiresAt')
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
              window.dispatchEvent(new CustomEvent('permissionsUpdated', { detail: { permissions: userData.permissions } }))
              // console.log('✅ Permissions guardados:', userData.permissions)
            } else {
              // Si es un objeto vacío, no guardar nada (o guardar null para indicar que no hay permissions)
              sessionStorage.removeItem('permissions')
              // console.log('ℹ️ Permissions vacío del servidor, usuario sin limitaciones')
            }
          } else if (userData.permissions === null || userData.permissions === undefined) {
            // Si es null o undefined, no guardar nada
            sessionStorage.removeItem('permissions')
            // console.log('ℹ️ No hay permissions definidos, usuario sin limitaciones')
          } else {
            // Cualquier otro caso, guardar como está
            sessionStorage.setItem('permissions', JSON.stringify(userData.permissions))
            // console.log('✅ Permissions guardados (formato no estándar):', userData.permissions)
          }
        } else {
          // console.log('ℹ️ Permissions ya existen en sessionStorage, no se sobrescriben para evitar problemas de seguridad')
        }
        
        // Guardar client_test (JSONB) para el selector de client_id
        // Guardar tanto en sessionStorage como en localStorage para persistencia
        if (userData.client_test) {
          const clientTestJson = JSON.stringify(userData.client_test)
          sessionStorage.setItem('client_test', clientTestJson)
          localStorage.setItem('user_client_test', clientTestJson)
          // console.log('✅ client_test guardado en sessionStorage y localStorage:', userData.client_test)
        } else {
          sessionStorage.removeItem('client_test')
          localStorage.removeItem('user_client_test')
        }
        
        // console.log('✅ Datos del usuario guardados en sessionStorage:', {
        //   clientId: clientIdToUse,
        //   defaultClientId: defaultClientId,
        //   selectedClientId: selectedClientId,
        //   email: userData.email,
        //   fullName: fullName,
        //   hasMetadata: !!userData.metadata,
        //   hasMetadataLlamadas: !!userData.metadata_llamadas,
        //   hasPermissions: !!userData.permissions,
        //   permissions: userData.permissions
        // })
        
        return clientIdToUse
      }
    } else {
      const errorText = await response.text()
      // console.error('Error en la respuesta del servidor:', response.status, errorText)
    }

    // Si no se puede obtener de la API, devolvemos null
    // console.warn('No se pudo obtener el client_id de get-client')
    return null
  } catch (error) {
    // console.error('Error obteniendo client_id:', error)
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

export const getApiKeyTest = (): string[] | null => {
  const apiKeyTest = sessionStorage.getItem('apiKeyTest')
  if (apiKeyTest) {
    try {
      return JSON.parse(apiKeyTest)
    } catch (e) {
      // console.warn('Error parseando apiKeyTest:', e)
      return null
    }
  }
  // También verificar en userData por si acaso
  const userData = getUserData()
  if (userData && userData.api_key_test && Array.isArray(userData.api_key_test)) {
    return userData.api_key_test
  }
  return null
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

function safeJsonParse<T>(raw: string | null): T | null {
  if (raw == null || raw === '') return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const getMetadata = (): Record<string, unknown> | null => {
  const metadata = sessionStorage.getItem('metadata')
  return safeJsonParse<Record<string, unknown>>(metadata)
}

export const getMetadataLlamadas = () => {
  const metadata_llamadas = sessionStorage.getItem('metadata_llamadas')
  return safeJsonParse(metadata_llamadas)
}

export const getPermissions = (): Record<string, boolean | undefined> | null => {
  const permissions = sessionStorage.getItem('permissions')
  return safeJsonParse<Record<string, boolean | undefined>>(permissions)
}

export const getClientTest = () => {
  // Primero intentar obtener desde sessionStorage
  let clientTest = sessionStorage.getItem('client_test')
  
  // Si no está en sessionStorage, intentar desde localStorage (persistencia)
  if (!clientTest) {
    clientTest = localStorage.getItem('user_client_test')
    if (clientTest) {
      // Restaurar también en sessionStorage para consistencia
      sessionStorage.setItem('client_test', clientTest)
      // console.log('✅ client_test restaurado desde localStorage a sessionStorage')
    }
  }
  
  return safeJsonParse(clientTest)
}

// Bloquea el Dashboard SOLO si permissions tiene dashboard=false explícitamente.
// Sin clave (o dashboard=true) → se muestra.
export const canAccessDashboard = (): boolean => {
  const permissions = getPermissions()
  if (!permissions) return true
  return permissions['dashboard'] !== false
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

// Helper interno: aplica AND entre permissions del usuario y metadata del cliente
// para features que no están en el union type de canAccess()
const canAccessFeature = (feature: string): boolean => {
  if (hasPermissionsDefined()) {
    const permissions = getPermissions()
    if (permissions?.[feature] !== true) return false
  }
  const metadata = getMetadata()
  if (metadata && feature in metadata) {
    return metadata[feature] === true
  }
  return false
}

// Función para verificar si el usuario tiene acceso a Tickets
export const canAccessTickets = (): boolean => canAccessFeature('tickets');

// Función para verificar si el usuario tiene acceso a Recoveries
export const canAccessRecoveries = (): boolean => canAccessFeature('recoveries');

// Función para verificar si el usuario tiene acceso a Soporte IA
export const canAccessAssistantIA = (): boolean => canAccessFeature('asistant_ia');

// Función para verificar si el usuario tiene acceso a Interesados
export const canAccessHydro = (): boolean => canAccessFeature('hydro');

// Función para verificar si el usuario tiene acceso a Seguimientos
export const canAccessSeguimientos = (): boolean => canAccessFeature('seguimiento');

// Función para verificar si el usuario tiene acceso a Presupuesto
export const canAccessBudget = (): boolean => canAccessFeature('budget');

// Función para verificar si el usuario tiene acceso a Agentes
export const canAccessAgentes = (): boolean => canAccessFeature('agentes');

// Obtiene el role del usuario desde userData en sessionStorage
export const getUserRole = (): string | null => {
  try {
    const userData = sessionStorage.getItem('userData');
    if (!userData) return null;
    return JSON.parse(userData)?.role || null;
  } catch {
    return null;
  }
};

export const isAdmin = (): boolean => getUserRole() === 'admin';
// Función para verificar si el usuario tiene acceso a una funcionalidad específica.
// Aplica AND entre permissions del usuario y metadata del cliente activo:
// - Si el usuario tiene permissions, debe tener el feature en true
// - El metadata del cliente activo debe tener el feature en true (si está definido)
// Esto permite que al cambiar de cliente, el acceso se ajuste al metadata de ese cliente.
export const canAccess = (feature: 'agenda' | 'records' | 'num_tel' | 'callbacks' | 'sales' | 'launch' | 'dont_call' | 'campaign'): boolean => {
  // Verificar permissions del usuario (solo si tiene permissions definidos)
  if (hasPermissionsDefined()) {
    const permissions = getPermissions()
    if (permissions?.[feature] !== true) return false
  }

  // Verificar metadata del cliente activo
  const metadata = getMetadata()
  if (metadata && feature in metadata) {
    return metadata[feature] === true
  }

  return true
}

export const hasLaunchPermissions = (): boolean => {
  return canAccess('launch')
}

export const isAuditor = (): boolean => {
  const permissions = getPermissions()
  if (permissions?.auditor !== true) return false
  const metadata = getMetadata()
  return metadata?.filtro_solar === true
}

export const getCurrentUserInfo = (): { email: string; name: string } => {
  const email = sessionStorage.getItem('email') ?? ''
  const name = sessionStorage.getItem('fullName') || email
  return { email, name }
}

// --- Helpers de suscripción ---

export const getSubscriptionExpiry = (): string | null => {
  return sessionStorage.getItem('subscriptionExpiresAt') || null
}

export const isSubscriptionExpired = (): boolean => {
  const expiresAt = getSubscriptionExpiry()
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

// Retorna false solo si active=false O si tiene fecha de expiración y ya venció.
// Sin fecha → nunca expira.
export const isClientActive = (): boolean => {
  if (sessionStorage.getItem('clientActive') === 'false') return false
  return !isSubscriptionExpired()
}

// Llama al backend con client_id para actualizar el estado de suscripción en sessionStorage.
// Se usa al cambiar de cliente (changeClientId).
export const updateClientSubscriptionStatus = async (clientId: string): Promise<void> => {
  try {
    const response = await fetch(`${BASE_URL}/get-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId })
    })
    if (!response.ok) return
    const data = await response.json()
    const userData = Array.isArray(data) ? data[0] : data
    if (!userData) return
    sessionStorage.setItem('clientActive', String(userData.active !== false))
    if (userData.subscription_expires_at) {
      sessionStorage.setItem('subscriptionExpiresAt', userData.subscription_expires_at)
    } else {
      sessionStorage.removeItem('subscriptionExpiresAt')
    }
  } catch {
    // Si falla, no bloqueamos — el estado previo permanece
  }
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
  sessionStorage.removeItem('client_test')
  sessionStorage.removeItem('clientActive')
  sessionStorage.removeItem('subscriptionExpiresAt')
  // También limpiar el client_id seleccionado y el client_test del usuario al cerrar sesión
  localStorage.removeItem('selected_client_id')
  localStorage.removeItem('user_client_test')
  // console.log('🧹 Datos del sessionStorage, client_id seleccionado y client_test limpiados')
}
