import { Callback, CallbackResponse } from '../../types';
import { getClientId, BASE_URL } from './config';




// Función para obtener callbacks
export async function fetchCallbacks(
  clientId?: string,
  page: number = 1,
  limit: number = 100,
  fechaInicio?: string,
  fechaFin?: string
): Promise<CallbackResponse> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    // console.log('Solicitando callbacks para client_id:', actualClientId);
    // console.log('Página:', page, 'Límite:', limit);
    // console.log('Filtros de fecha:', { fechaInicio, fechaFin });
    
    const requestBody: any = {
      client_id: actualClientId,
      page: page,
      limit: limit
    };
    
    // Agregar filtros de fecha si están disponibles
    if (fechaInicio) {
      // Formatear fecha_inicio: si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00Z
      let fechaInicioFormatted = fechaInicio;
      if (fechaInicio.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
        fechaInicioFormatted = `${fechaInicio}T00:00:00Z`;
      } else if (fechaInicio.length === 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fechaInicio)) {
        fechaInicioFormatted = `${fechaInicio}Z`;
      }
      requestBody.fecha_inicio = fechaInicioFormatted;
    }
    
    if (fechaFin) {
      // Formatear fecha_fin: si es solo fecha (YYYY-MM-DD), agregar hora 23:59:59Z
      let fechaFinFormatted = fechaFin;
      if (fechaFin.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
        fechaFinFormatted = `${fechaFin}T23:59:59Z`;
      } else if (fechaFin.length === 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fechaFin)) {
        fechaFinFormatted = `${fechaFin}Z`;
      }
      requestBody.fecha_fin = fechaFinFormatted;
    }
    
    const response = await fetch(`${BASE_URL}/api/calls/list-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener callbacks: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: CallbackResponse = await response.json();
    // console.log('Respuesta del endpoint list-callback:', data);
    
    return data;
    
  } catch (error) {
    // console.error('Error al obtener callbacks:', error);
    throw error;
  }
}



// Función para obtener todas las callbacks con paginación automática
export async function fetchAllCallbacks(
  clientId: string
): Promise<Callback[]> {
  try {
    // console.log('Obteniendo todas las callbacks para client_id:', clientId);
    
    let allCallbacks: Callback[] = [];
    let page = 1;
    let hasMore = true;
    let totalPages = 0;
    
    while (hasMore) {
      const response = await fetchCallbacks(clientId, page, 100);
      
      allCallbacks = [...allCallbacks, ...response.callbacks];
      
      // Si es la primera página, obtener el total de páginas
      if (page === 1 && response.total_paginas) {
        totalPages = response.total_paginas;
      }
      
      // Determinar si hay más páginas
      if (totalPages > 0) {
        hasMore = page < totalPages;
      } else {
        // Si no conocemos el total, usar la heurística
        hasMore = response.callbacks.length === 100;
      }
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificación de seguridad para evitar bucles infinitos
        if (page > 100) {
          // console.warn('Límite de páginas alcanzado (100), deteniendo paginación');
          break;
        }
      }
    }
    
    // console.log(`Total de callbacks obtenidas: ${allCallbacks.length}`);
    return allCallbacks;
    
  } catch (error) {
    // console.error('Error al obtener todas las callbacks:', error);
    throw error;
  }
}



// Función para obtener callbacks con límite inicial (optimizada para carga rápida)
export async function fetchCallbacksWithLimit(
  clientId: string,
  limit: number = 500,
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ callbacks: Callback[]; hasMore: boolean; totalCallbacks: number }> {
  try {
    // console.log(`Obteniendo primeros ${limit} callbacks para client_id:`, clientId);
    // console.log('Filtros de fecha:', { fechaInicio, fechaFin });
    
    let allCallbacks: Callback[] = [];
    let page = 1;
    let hasMore = true;
    let totalCallbacks = 0;
    
    while (hasMore && allCallbacks.length < limit) {
      const response = await fetchCallbacks(clientId, page, 100, fechaInicio, fechaFin);
      
      // Si es la primera página, obtener el total de callbacks
      if (page === 1) {
        totalCallbacks = response.total_callbacks || 0;
      }
      
      // Agregar callbacks hasta alcanzar el límite
      const remainingSlots = limit - allCallbacks.length;
      const callbacksToAdd = response.callbacks.slice(0, remainingSlots);
      allCallbacks = [...allCallbacks, ...callbacksToAdd];
      
      // Si obtuvimos menos de 100 callbacks, no hay más páginas
      hasMore = response.callbacks.length === 100 && allCallbacks.length < limit;
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    const hasMoreCallbacks = allCallbacks.length < totalCallbacks;
    
    // console.log(`Callbacks obtenidos: ${allCallbacks.length}/${totalCallbacks}, Hay más: ${hasMoreCallbacks}`);
    return {
      callbacks: allCallbacks,
      hasMore: hasMoreCallbacks,
      totalCallbacks
    };
    
  } catch (error) {
    // console.error('Error al obtener callbacks con límite:', error);
    throw error;
  }
}



// Función para cargar más callbacks (continuación de la paginación)
export async function loadMoreCallbacks(
  clientId: string,
  currentCallbacks: Callback[],
  additionalLimit: number = 500,
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ callbacks: Callback[]; hasMore: boolean; totalCallbacks: number }> {
  try {
    // console.log(`Cargando ${additionalLimit} callbacks adicionales para client_id:`, clientId);
    // console.log('Filtros de fecha:', { fechaInicio, fechaFin });
    
    // Calcular desde qué página continuar
    const currentPage = Math.ceil(currentCallbacks.length / 100);
    const startPage = currentPage + 1;
    
    let allCallbacks = [...currentCallbacks];
    let page = startPage;
    let hasMore = true;
    let totalCallbacks = 0;
    let loadedCount = 0;
    
    while (hasMore && loadedCount < additionalLimit) {
      const response = await fetchCallbacks(clientId, page, 100, fechaInicio, fechaFin);
      
      // Si es la primera página de esta carga, obtener el total
      if (page === startPage) {
        totalCallbacks = response.total_callbacks || 0;
      }
      
      // Agregar callbacks hasta alcanzar el límite adicional
      const remainingSlots = additionalLimit - loadedCount;
      const callbacksToAdd = response.callbacks.slice(0, remainingSlots);
      allCallbacks = [...allCallbacks, ...callbacksToAdd];
      loadedCount += callbacksToAdd.length;
      
      // Si obtuvimos menos de 100 callbacks, no hay más páginas
      hasMore = response.callbacks.length === 100 && loadedCount < additionalLimit;
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    const hasMoreCallbacks = allCallbacks.length < totalCallbacks;
    
    // console.log(`Callbacks adicionales cargados: ${loadedCount}, Total: ${allCallbacks.length}/${totalCallbacks}, Hay más: ${hasMoreCallbacks}`);
    return {
      callbacks: allCallbacks,
      hasMore: hasMoreCallbacks,
      totalCallbacks
    };
    
  } catch (error) {
    // console.error('Error al cargar más callbacks:', error);
    throw error;
  }
}



// Función para exportar TODOS los callbacks con filtros de fecha
export async function exportAllCallbacks(
  clientId: string,
  params: {
    fecha_inicio?: string;
    fecha_fin?: string;
    phone_number?: string;
    sort_order?: 'ASC' | 'DESC';
    sort_by?: 'date_to_call' | 'created_at';
  }
): Promise<{ callbacks: Callback[]; total_callbacks: number }> {
  try {
    if (!clientId) {
      throw new Error('client_id es obligatorio para exportAllCallbacks');
    }
    
    // console.log('Exportando callbacks con parámetros:', params);
    
    const url = `${BASE_URL}/api/calls/list-callbacks-all`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        ...params
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en exportAllCallbacks: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Callbacks exportados:', data.callbacks.length);
    
    return {
      callbacks: data.callbacks || [],
      total_callbacks: data.total_callbacks || 0
    };
  } catch (error) {
    // console.error('Error al exportar callbacks:', error);
    throw error;
  }
}

