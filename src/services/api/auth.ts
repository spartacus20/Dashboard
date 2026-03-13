import { ClientData } from '../../types';
import { BASE_URL, GET_CLIENT_WEBHOOK_URL } from './config';




// Función para obtener la API key del cliente
export async function getClientApiKey(identifier: string): Promise<{ apiKey: string | null; apiKeyTest?: string[] | null; clientId: string | null; permissions?: Record<string, any> | null; config?: Record<string, any> }> {
  try {
    // console.log('Solicitando API key para el identificador:', identifier);
    
    // Determinar si el identificador es un email o un client_id
    const isEmail = identifier.includes('@');
    const requestBody = isEmail ? { email: identifier } : { client_id: identifier };
    // console.log('🔍 DEBUG - Variables de entorno:');
    // console.log('VITE_PRODUCTION_API:', import.meta.env.VITE_PRODUCTION_API);
    // console.log('VITE_BASE_PROD:', import.meta.env.VITE_BASE_PROD);
    // console.log('VITE_BASE_DEV:', import.meta.env.VITE_BASE_DEV);
    // console.log('BASE_URL que se está usando:', BASE_URL); // si usas la config que te pasé
    const response = await fetch(GET_CLIENT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener API key: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del webhook:', data);
    
    // El webhook devuelve un array con los datos del cliente
    if (Array.isArray(data) && data.length > 0) {
      const clientData: ClientData = data[0];
      // console.log('Cliente encontrado:', {
        // client_id: clientData.client_id,
        // email: clientData.email,
        // full_name: clientData.full_name || 'Sin nombre'
      // });
      
      // Guardar metadata_llamadas en sessionStorage. Siempre actualizar al cambiar de cliente para evitar cache del anterior
      if (clientData.metadata_llamadas) {
        sessionStorage.setItem('metadata_llamadas', JSON.stringify(clientData.metadata_llamadas));
        // console.log('✅ metadata_llamadas guardado en sessionStorage');
      } else {
        sessionStorage.removeItem('metadata_llamadas');
      }

      // Guardar metadata (incluye filtro_solar y otros permisos de módulos) en sessionStorage
      if (clientData.metadata) {
        sessionStorage.setItem('metadata', JSON.stringify(clientData.metadata));
        // console.log('✅ metadata guardado en sessionStorage para client_id:', clientData.client_id);
        // Notificar al resto de la app que el metadata cambió (por ejemplo, al cambiar de client_id)
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata: clientData.metadata },
          })
        );
      } else {
        // Si no hay metadata, limpiar y notificar
        sessionStorage.removeItem('metadata');
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata: null },
          })
        );
      }

      // Guardar uri_retell (URIs de terminación) en sessionStorage si está disponible
      if (clientData.uri_retell) {
        let uriRetell: string[] | null = null;
        if (Array.isArray(clientData.uri_retell)) {
          uriRetell = clientData.uri_retell;
        } else if (typeof clientData.uri_retell === 'string') {
          try {
            const parsed = JSON.parse(clientData.uri_retell);
            if (Array.isArray(parsed)) {
              uriRetell = parsed.filter((v): v is string => typeof v === 'string');
            }
          } catch (e) {
            // console.warn('Error parseando uri_retell (string) desde get-client:', e);
          }
        }

        if (uriRetell && uriRetell.length > 0) {
          sessionStorage.setItem('uri_retell', JSON.stringify(uriRetell));
          // console.log('✅ uri_retell guardado en sessionStorage:', uriRetell);
        }
      }
      
      // Guardar client_test SOLO si se está obteniendo por email (no por client_id)
      // Esto preserva el client_test original del usuario cuando se cambia el client_id
      const isEmail = identifier.includes('@');
      if (isEmail && clientData.client_test) {
        sessionStorage.setItem('client_test', JSON.stringify(clientData.client_test));
        // También guardar en localStorage para persistencia
        localStorage.setItem('user_client_test', JSON.stringify(clientData.client_test));
        // console.log('✅ client_test guardado en sessionStorage y localStorage (obtenido por email):', clientData.client_test);
      } else if (!isEmail) {
        // Si se está obteniendo por client_id, NO sobrescribir el client_test original
        // Restaurar desde localStorage si existe
        const savedClientTest = localStorage.getItem('user_client_test');
        if (savedClientTest) {
          sessionStorage.setItem('client_test', savedClientTest);
          // console.log('✅ client_test restaurado desde localStorage (no sobrescribir al cambiar client_id)');
        } else {
          // console.log('ℹ️ No hay client_test guardado, manteniendo el actual');
        }
      }
      
      // Guardar permissions SOLO si no existen ya en sessionStorage (evitar sobrescribir en refresh)
      const existingPermissions = sessionStorage.getItem('permissions');
      if (!existingPermissions) {
        // Solo actualizar si no existen permissions previos
        if (clientData.permissions && typeof clientData.permissions === 'object') {
          const permissionsKeys = Object.keys(clientData.permissions);
          if (permissionsKeys.length > 0) {
            // Si tiene al menos una propiedad, guardarlo
            sessionStorage.setItem('permissions', JSON.stringify(clientData.permissions));
            // console.log('✅ permissions guardado en sessionStorage:', clientData.permissions);
          } else {
            // Si es un objeto vacío, no guardar nada
            sessionStorage.removeItem('permissions');
            // console.log('ℹ️ Permissions vacío del servidor, usuario sin limitaciones');
          }
        } else if (clientData.permissions === null || clientData.permissions === undefined) {
          // Si es null o undefined, no guardar nada
          sessionStorage.removeItem('permissions');
          // console.log('ℹ️ No hay permissions definidos, usuario sin limitaciones');
        }
      } else {
        // console.log('ℹ️ Permissions ya existen en sessionStorage, no se sobrescriben para evitar problemas de seguridad');
      }
      
      // console.log('🔧 Configuración construida:', {
        // metadata: clientData.metadata,
        // permissions: clientData.permissions,
        // config: {
          // sales: clientData.metadata?.sales,
          // agenda: clientData.metadata?.agenda,
          // num_tel: clientData.metadata?.num_tel,
          // records: clientData.metadata?.records,
          // callbacks: clientData.metadata?.callbacks,
          // launch: clientData.metadata?.launch,
          // dont_call: clientData.metadata?.dont_call,
          // campaign: clientData.metadata?.campaign,
        // }
      // });
      
      // Determinar qué API keys usar: api_key_test si está disponible, sino api_key
      const apiKeyTest = clientData.api_key_test && Array.isArray(clientData.api_key_test) && clientData.api_key_test.length > 0
        ? clientData.api_key_test
        : null;

      return {
        apiKey: clientData.api_key || null,
        apiKeyTest: apiKeyTest,
        clientId: clientData.client_id || null,
        permissions: clientData.permissions || null,
        config: clientData.config ?? {
          agenda_enabled: clientData.agenda_enabled,
          calls_enabled: clientData.calls_enabled,
          sales: clientData.metadata?.sales,
          agenda: clientData.metadata?.agenda,
          num_tel: clientData.metadata?.num_tel,
          records: clientData.metadata?.records,
          callbacks: clientData.metadata?.callbacks,
          launch: clientData.metadata?.launch,
          dont_call: clientData.metadata?.dont_call,
          campaign: clientData.metadata?.campaign,
        }
      };
    }
    
    // Si no es un array, intentar obtener directamente
    if (data && typeof data === 'object') {
      // Guardar metadata_llamadas en sessionStorage. Limpiar si el cliente no la tiene para evitar cache del anterior
      if (data.metadata_llamadas) {
        sessionStorage.setItem('metadata_llamadas', JSON.stringify(data.metadata_llamadas));
        // console.log('✅ metadata_llamadas guardado en sessionStorage (formato objeto)');
      } else {
        sessionStorage.removeItem('metadata_llamadas');
      }

      // Guardar metadata (incluye filtro_solar y otros permisos de módulos) en sessionStorage
      if ((data as any).metadata) {
        const metadata = (data as any).metadata;
        sessionStorage.setItem('metadata', JSON.stringify(metadata));
        // console.log('✅ metadata guardado en sessionStorage (formato objeto)');
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata },
          })
        );
      } else {
        sessionStorage.removeItem('metadata');
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata: null },
          })
        );
      }

      // Guardar uri_retell (URIs de terminación) en sessionStorage si está disponible - formato objeto
      if (data.uri_retell) {
        let uriRetell: string[] | null = null;
        if (Array.isArray(data.uri_retell)) {
          uriRetell = data.uri_retell;
        } else if (typeof data.uri_retell === 'string') {
          try {
            const parsed = JSON.parse(data.uri_retell);
            if (Array.isArray(parsed)) {
              uriRetell = parsed.filter((v): v is string => typeof v === 'string');
            }
          } catch (e) {
            // console.warn('Error parseando uri_retell (string, formato objeto) desde get-client:', e);
          }
        }

        if (uriRetell && uriRetell.length > 0) {
          sessionStorage.setItem('uri_retell', JSON.stringify(uriRetell));
          // console.log('✅ uri_retell guardado en sessionStorage (formato objeto):', uriRetell);
        }
      }
      
      // Guardar client_test SOLO si se está obteniendo por email (no por client_id)
      // Esto preserva el client_test original del usuario cuando se cambia el client_id
      const isEmail = identifier.includes('@');
      if (isEmail && data.client_test) {
        sessionStorage.setItem('client_test', JSON.stringify(data.client_test));
        // También guardar en localStorage para persistencia
        localStorage.setItem('user_client_test', JSON.stringify(data.client_test));
        // console.log('✅ client_test guardado en sessionStorage y localStorage (formato objeto, obtenido por email):', data.client_test);
      } else if (!isEmail) {
        // Si se está obteniendo por client_id, NO sobrescribir el client_test original
        // Restaurar desde localStorage si existe
        const savedClientTest = localStorage.getItem('user_client_test');
        if (savedClientTest) {
          sessionStorage.setItem('client_test', savedClientTest);
          // console.log('✅ client_test restaurado desde localStorage (formato objeto, no sobrescribir al cambiar client_id)');
        } else {
          // console.log('ℹ️ No hay client_test guardado, manteniendo el actual');
        }
      }
      
      // Guardar permissions SOLO si no existen ya en sessionStorage (evitar sobrescribir en refresh)
      const existingPermissions = sessionStorage.getItem('permissions');
      if (!existingPermissions) {
        // Solo actualizar si no existen permissions previos
        if (data.permissions && typeof data.permissions === 'object') {
          const permissionsKeys = Object.keys(data.permissions);
          if (permissionsKeys.length > 0) {
            // Si tiene al menos una propiedad, guardarlo
            sessionStorage.setItem('permissions', JSON.stringify(data.permissions));
            // console.log('✅ permissions guardado en sessionStorage (formato objeto):', data.permissions);
          } else {
            // Si es un objeto vacío, no guardar nada
            sessionStorage.removeItem('permissions');
            // console.log('ℹ️ Permissions vacío del servidor (formato objeto), usuario sin limitaciones');
          }
        } else if (data.permissions === null || data.permissions === undefined) {
          // Si es null o undefined, no guardar nada
          sessionStorage.removeItem('permissions');
          // console.log('ℹ️ No hay permissions definidos (formato objeto), usuario sin limitaciones');
        }
      } else {
        // console.log('ℹ️ Permissions ya existen en sessionStorage, no se sobrescriben para evitar problemas de seguridad');
      }
      
      // Determinar qué API keys usar: api_key_test si está disponible, sino api_key
      const apiKeyTest = data.api_key_test && Array.isArray(data.api_key_test) && data.api_key_test.length > 0
        ? data.api_key_test
        : null;

      return {
        apiKey: data.api_key || data.apiKey || null,
        apiKeyTest: apiKeyTest,
        clientId: data.client_id || data.clientId || null,
        permissions: data.permissions || null,
        config: data.config ?? {
          agenda_enabled: data.agenda_enabled,
          calls_enabled: data.calls_enabled,
          sales: data.metadata?.sales,
          agenda: data.metadata?.agenda,
          num_tel: data.metadata?.num_tel,
          records: data.metadata?.records,
          callbacks: data.metadata?.callbacks,
          launch: data.metadata?.launch,
          dont_call: data.metadata?.dont_call,
          campaign: data.metadata?.campaign,
        }
      };
    }
    
    // console.warn('No se encontró información del cliente');
    return { apiKey: null, apiKeyTest: null, clientId: null, permissions: null };
  } catch (error) {
    // console.error('Error al obtener API key del cliente:', error);
    return { apiKey: null, clientId: null, permissions: null };
  }
}

