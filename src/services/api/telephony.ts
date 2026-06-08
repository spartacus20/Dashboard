import { RetellPhoneNumber } from '../../types';
import { getWorkspaceNameFromWebhook } from './calls';




interface CreatePhoneCallParams {
  from_number: string;
  to_number: string;
  override_agent_id?: string;
  retell_llm_dynamic_variables?: Record<string, any>;
}


// Función para obtener números de teléfono de una sola API key
async function fetchPhoneNumbersFromSingleApiKey(apiKey: string): Promise<RetellPhoneNumber[]> {
  const response = await fetch('https://api.retellai.com/v2/list-phone-numbers', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Error al obtener números de teléfono: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);

  return items;
}



// Función principal para obtener números de teléfono de una o múltiples API keys
export async function fetchPhoneNumbers(apiKey: string | string[]): Promise<RetellPhoneNumber[]> {
  // Si es un array, obtener números de todas las API keys y combinarlos
  if (Array.isArray(apiKey)) {
    // console.log(`📞 Obteniendo números de teléfono de ${apiKey.length} API keys`);
    
    // Obtener números de todas las API keys en paralelo y adjuntar metadata de workspace
    const results = await Promise.all(
      apiKey.map(async (key) => {
        const numbers = await fetchPhoneNumbersFromSingleApiKey(key).catch(() => {
          // console.error(
            // `❌ Error obteniendo números de teléfono para API key ${key.substring(0, 10)}...:`,
            // err
          // );
          return [] as RetellPhoneNumber[]; // Devolver array vacío en caso de error para no romper el flujo
        });

        return numbers.map((phone) => {
          const workspaceName = getWorkspaceNameFromWebhook(phone.inbound_webhook_url);
          return {
            ...phone,
            workspace_api_key: key,
            workspace_name: workspaceName || undefined,
          };
        });
      })
    );
    
    // Combinar todos los resultados y eliminar duplicados por phone_number
    const allNumbers = results.flat();
    const uniqueNumbers = Array.from(
      new Map(allNumbers.map(phone => [phone.phone_number, phone])).values()
    );
    
    // console.log(`✅ Total de números únicos obtenidos: ${uniqueNumbers.length}`);
    return uniqueNumbers;
  }
  
  // Si es una sola API key, usar la función original y adjuntar metadata de workspace
  const numbers = await fetchPhoneNumbersFromSingleApiKey(apiKey);
  return numbers.map((phone) => {
    const workspaceName = getWorkspaceNameFromWebhook(phone.inbound_webhook_url);
    return {
      ...phone,
      workspace_api_key: apiKey,
      workspace_name: workspaceName || undefined,
    };
  });
}



export async function createPhoneCall(apiKey: string, params: CreatePhoneCallParams): Promise<any> {
  const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear llamada: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}



// Función para importar un número de teléfono
export async function importPhoneNumber(
  apiKey: string,
  phoneData: {
    phone_number: string;
    termination_uri?: string;
    sip_trunk_auth_username?: string;
    sip_trunk_auth_password?: string;
    nickname?: string;
  }
): Promise<any> {
  try {
    // console.log('Importando número de teléfono:', phoneData.phone_number);
    
    const response = await fetch('https://api.retellai.com/import-phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(phoneData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al importar número de teléfono: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta de importación:', data);
    
    return data;
  } catch (error) {
    // console.error('Error al importar número de teléfono:', error);
    throw error;
  }
}



// Función para eliminar un número de teléfono
export async function deletePhoneNumber(
  apiKey: string,
  phoneNumber: string
): Promise<any> {
  try {
    // console.log('Eliminando número de teléfono:', phoneNumber);
    
    const response = await fetch(`https://api.retellai.com/delete-phone-number/${phoneNumber}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al eliminar número de teléfono: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Para DELETE, la respuesta puede estar vacía (204 No Content)
    const data = response.status === 204 ? { success: true } : await response.json();
    // console.log('Respuesta de eliminación:', data);
    
    return data;
  } catch (error) {
    // console.error('Error al eliminar número de teléfono:', error);
    throw error;
  }
}

