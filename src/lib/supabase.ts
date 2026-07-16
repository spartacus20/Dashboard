import { createClient, Session } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Margen amplio: el access_token dura 1h, pero lo renovamos con 60s de anticipación para
// cubrir el desfasaje entre el reloj del navegador y el de Supabase (con 30s, un reloj
// atrasado hacía que el front creyera que el token seguía vivo y el servidor lo rechazara).
const MARGEN_EXPIRACION_MS = 60_000

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function estaPorVencer(session: Session | null): boolean {
  if (!session?.expires_at) return true
  return session.expires_at * 1000 - Date.now() < MARGEN_EXPIRACION_MS
}

// Devuelve un access_token FRESCO, o null si no hay ninguno utilizable.
//
// NUNCA devuelve un token vencido: mandarlo solo produce un 401 confuso.
//
// El refresh_token de Supabase es de UN SOLO USO y rota en cada renovación. Cuando volvés
// a una pestaña que estuvo oculta, supabase-js reanuda su auto-refresh justo cuando los
// componentes se re-montan y piden datos: dos refrescos compiten por el mismo refresh_token
// y uno falla. En ese caso la sesión nueva YA quedó en storage, así que la releemos en vez
// de reintentar el refresh (que volvería a fallar con el token ya consumido).
export async function getFreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return null
  if (!estaPorVencer(session)) return session.access_token ?? null

  const { data: refrescada, error } = await supabase.auth.refreshSession()
  if (!error && refrescada.session) return refrescada.session.access_token ?? null

  // Falló el refresh: probablemente otro lo ganó. Le damos un respiro y releemos storage.
  await dormir(150)
  const { data: reintento } = await supabase.auth.getSession()
  const nueva = reintento.session
  if (nueva && !estaPorVencer(nueva)) return nueva.access_token ?? null

  return null
}

// Fuerza una renovación, ignorando el margen. La usa el reintento ante un 401: si el token
// murió entre que armamos los headers y el servidor lo validó, esto consigue uno nuevo.
// Si el refresh falla porque otro lo ganó, devolvemos el que haya quedado en storage.
export async function forceRefreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession()
  if (!error && data.session) return data.session.access_token ?? null

  await dormir(150)
  const { data: actual } = await supabase.auth.getSession()
  const session = actual.session
  if (session && !estaPorVencer(session)) return session.access_token ?? null
  return null
}

// Headers con el token de sesión de Supabase para autenticar llamadas al backend.
// Se define local aquí (en vez de importar services/api/http) para evitar un import
// circular: http.ts importa este mismo módulo.
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getFreshAccessToken()
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

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
      headers: await authHeaders(),
      // no-store: /get-client es data de sesión/tenant, nunca debe cachearse ni
      // revalidarse (un 304 devolvería body vacío/viejo → apiKey no cargaría).
      cache: 'no-store',
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
        
        // Guardar los datos en sessionStorage, SIN las claves de Retell.
        // Chunk 13a: la API key nunca debe quedar at-rest en el navegador.
        const userDataToStore = { ...userData }
        delete userDataToStore.api_key
        delete userDataToStore.apiKey
        delete userDataToStore.api_key_test
        sessionStorage.setItem('userData', JSON.stringify(userDataToStore))
        persistAccountCreatedAt(userData)
        sessionStorage.setItem('clientId', clientIdToUse)
        if (userData.email) {
          sessionStorage.setItem('email', userData.email)
        }
        sessionStorage.setItem('fullName', fullName)
        if (fullName) {
          window.dispatchEvent(
            new CustomEvent('profileUpdated', { detail: { fullName } }),
          )
        }
        
        // Guardar metadatos solo cuando se usa el cliente por defecto.
        // Si el usuario tiene otro cliente seleccionado, el metadata correcto
        // lo carga getClientApiKey(clientIdToUse) en CallsContext; saltarse este
        // paso evita el flash que mostraría secciones del cliente base antes de
        // que carguen las del cliente seleccionado.
        if (clientIdToUse === defaultClientId) {
          if (userData.metadata) {
            sessionStorage.setItem('metadata', JSON.stringify(userData.metadata))
            window.dispatchEvent(new CustomEvent('metadataUpdated', {
              detail: { metadata: userData.metadata }
            }))
          }
          if (userData.metadata_llamadas) {
            sessionStorage.setItem('metadata_llamadas', JSON.stringify(userData.metadata_llamadas))
          } else {
            sessionStorage.removeItem('metadata_llamadas')
          }
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

// Chunk 13a: la Retell API key ya no se persiste en el navegador (ni en
// sessionStorage ni en el blob userData). Estos helpers quedan como no-ops —
// nada del cliente debe leer la key desde storage. La key vive solo en memoria
// (estado de CallsContext) mientras el selector de workspaces la necesita, hasta
// que 13b termine de sacarla del backend.
export const getApiKey = (): string | null => null

export const getApiKeyTest = (): string[] | null => null

export const getClientIdFromSession = (): string | null => {
  return sessionStorage.getItem('clientId')
}

export const getEmail = (): string | null => {
  return sessionStorage.getItem('email')
}

export const getFullName = (): string | null => {
  return sessionStorage.getItem('fullName')
}

function normalizeAccountDateValue(value: unknown): string | null {
  if (value == null || value === '') return null

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  return null
}

export const persistAccountCreatedAt = (
  userData: Record<string, unknown> | null | undefined,
): string | null => {
  const normalized = normalizeAccountDateValue(
    userData?.created_at ?? userData?.createdAt,
  )

  if (normalized) {
    sessionStorage.setItem('accountCreatedAt', normalized)
  } else {
    sessionStorage.removeItem('accountCreatedAt')
  }

  return normalized
}

export const getAccountCreatedAt = (): string | null => {
  const fromSession = sessionStorage.getItem('accountCreatedAt')
  if (fromSession) {
    const normalized = normalizeAccountDateValue(fromSession)
    if (normalized) return normalized
  }

  const userData = getUserData()
  if (!userData) return null
  return normalizeAccountDateValue(userData.created_at ?? userData.createdAt)
}

export const setFullName = (fullName: string): void => {
  sessionStorage.setItem('fullName', fullName)

  const userData = getUserData()
  if (userData) {
    userData.fullName = fullName
    userData.full_name = fullName
    sessionStorage.setItem('userData', JSON.stringify(userData))
  }

  window.dispatchEvent(
    new CustomEvent('profileUpdated', {
      detail: { fullName },
    }),
  )
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

// Función para verificar si el usuario tiene acceso a Campañas Programadas
// (batch service — flag clients.metadata.batch_campaigns, gateado también en backend)
export const canAccessBatchCampaigns = (): boolean => canAccessFeature('batch_campaigns');

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
  // Si el cliente no tiene la feature definida en metadata → ocultar (false)
  const metadata = getMetadata()
  if (metadata && feature in metadata) {
    return metadata[feature] === true
  }

  return false
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
      headers: await authHeaders(),
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
  sessionStorage.removeItem('apiKeyTest')
  sessionStorage.removeItem('clientId')
  sessionStorage.removeItem('email')
  sessionStorage.removeItem('fullName')
  sessionStorage.removeItem('metadata')
  sessionStorage.removeItem('metadata_llamadas')
  sessionStorage.removeItem('permissions')
  sessionStorage.removeItem('client_test')
  sessionStorage.removeItem('clientActive')
  sessionStorage.removeItem('subscriptionExpiresAt')
  sessionStorage.removeItem('accountCreatedAt')
  // También limpiar el client_id seleccionado y el client_test del usuario al cerrar sesión
  localStorage.removeItem('selected_client_id')
  localStorage.removeItem('user_client_test')
  // console.log('🧹 Datos del sessionStorage, client_id seleccionado y client_test limpiados')
}
