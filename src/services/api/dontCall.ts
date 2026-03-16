import { BASE_URL } from "./config";
import type { BlockedNumber } from "../../types";


export async function listDontCallRecords(
  apiKey: string,
  params: {
    client_id: string;
    per_page?: number;
    page?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    search_term?: string;
    filter_status?: 'all' | 'active' | 'inactive';
    sort_order?: 'ASC' | 'DESC';
  }
): Promise<{
  registros: any[];
  total_registros: number;
  total_paginas: number;
  pagina_actual: number;
  limit: number;
}> {
  try {
    if (!params?.client_id) {
      throw new Error('client_id es obligatorio para listDontCallRecords');
    }

    const url = `${BASE_URL}/api/dont-call/list`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener registros de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del endpoint listDontCallRecords:', data);
    
    return {
      registros: data.registros || [],
      total_registros: data.total_registros || 0,
      total_paginas: data.total_paginas || 0,
      pagina_actual: data.pagina_actual || 1,
      limit: data.limit || 50
    };
  } catch (error) {
    // console.error('Error al obtener registros de No Llamar:', error);
    throw error;
  }
}

export async function createDontCallRecord(
  apiKey: string,
  params: {
    client_id: string;
    phone_number: string;
    nombre?: string;
    motivo?: string;
    fecha_registro?: string;
    call_id?: string;
    region?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  data: any;
}> {
  try {
    if (!params?.client_id || !params?.phone_number) {
      throw new Error('client_id y phone_number son obligatorios para createDontCallRecord');
    }

    const url = `${BASE_URL}/api/dont-call/create`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al crear registro de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del endpoint createDontCallRecord:', data);
    
    return data;
  } catch (error) {
    // console.error('Error al crear registro de No Llamar:', error);
    throw error;
  }
}

export async function updateDontCallRecord(
  apiKey: string,
  id: string,
  params: {
    phone_number?: string;
    nombre?: string;
    motivo?: string;
    fecha_registro?: string;
    activo?: boolean;
    region?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  data: any;
}> {
  try {
    if (!id) {
      throw new Error('ID es obligatorio para updateDontCallRecord');
    }

    const url = `${BASE_URL}/api/dont-call/${id}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al actualizar registro de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del endpoint updateDontCallRecord:', data);
    
    return data;
  } catch (error) {
    // console.error('Error al actualizar registro de No Llamar:', error);
    throw error;
  }
}

// ====== NÚMEROS BLOQUEADOS (numeros_block) ======

export async function listBlockedNumbers(): Promise<BlockedNumber[]> {
  try {
    const url = `${BASE_URL}/api/blocked-numbers/list`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al obtener números bloqueados: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.numeros || [];
  } catch (error) {
    // console.error('Error en listBlockedNumbers:', error);
    throw error;
  }
}

export async function createBlockedNumber(params: {
  number: string;
  name?: string;
}): Promise<BlockedNumber> {
  try {
    const url = `${BASE_URL}/api/blocked-numbers/create`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear número bloqueado: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.data as BlockedNumber;
  } catch (error) {
    // console.error('Error en createBlockedNumber:', error);
    throw error;
  }
}

export async function updateBlockedNumber(
  originalNumber: string,
  params: {
    number?: string;
    name?: string;
  }
): Promise<BlockedNumber> {
  try {
    const url = `${BASE_URL}/api/blocked-numbers/${encodeURIComponent(originalNumber)}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al actualizar número bloqueado: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.data as BlockedNumber;
  } catch (error) {
    // console.error('Error en updateBlockedNumber:', error);
    throw error;
  }
}

export async function deleteBlockedNumber(number: string): Promise<void> {
  try {
    const url = `${BASE_URL}/api/blocked-numbers/${encodeURIComponent(number)}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al eliminar número bloqueado: ${response.status} ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    // console.error('Error en deleteBlockedNumber:', error);
    throw error;
  }
}

export async function deleteDontCallRecord(
  apiKey: string,
  id: string
): Promise<{
  success: boolean;
  message: string;
  data: any;
}> {
  try {
    if (!id) {
      throw new Error('ID es obligatorio para deleteDontCallRecord');
    }

    const url = `${BASE_URL}/api/dont-call/${id}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al eliminar registro de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del endpoint deleteDontCallRecord:', data);
    
    return data;
  } catch (error) {
    // console.error('Error al eliminar registro de No Llamar:', error);
    throw error;
  }
}

export async function getDontCallStats(
  apiKey: string,
  params: {
    client_id: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }
): Promise<{
  success: boolean;
  total_registros: number;
  registros_activos: number;
  registros_inactivos: number;
  con_region: number;
  sin_region: number;
}> {
  try {
    if (!params?.client_id) {
      throw new Error('client_id es obligatorio para getDontCallStats');
    }

    const url = `${BASE_URL}/api/dont-call/stats`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener estadísticas de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del endpoint getDontCallStats:', data);
    
    return data;
  } catch (error) {
    // console.error('Error al obtener estadísticas de No Llamar:', error);
    throw error;
  }
}