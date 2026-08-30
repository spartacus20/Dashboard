import { RetellAgent, CallsByPhoneResponse, RetellFolder } from '../../types';
import { getClientId, BASE_URL, ASISTENCIA_FUNNEL_URL, GET_CALL_TRANSCRIPT_URL } from './config';
import { authHeaders } from './http';

// Obtiene las carpetas (folders) de un workspace específico via backend proxy.
// El resultado sirve para determinar el nombre del workspace.
export async function fetchFolders(clientId: string, workspaceIndex = 0): Promise<RetellFolder[]> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/workspaces`,
    { headers: await authHeaders() }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener folders: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  const workspaces: { index: number; name: string; folders: RetellFolder[] }[] = result.data || [];
  const workspace = workspaces.find((w) => w.index === workspaceIndex);
  return workspace?.folders ?? [];
}

// Obtiene los agentes de un workspace específico via backend proxy.
export async function fetchAgents(clientId: string, workspaceIndex = 0): Promise<RetellAgent[]> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/agents?workspace_index=${workspaceIndex}`,
    { headers: await authHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Error al obtener agentes: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.data ?? [];
}



// Obtener distribución de clicks de asistencia por hora
export async function fetchAsistenciaClicksByHour(
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ hora: number; clicks_totales: number }[]> {
  try {
    const url = `${BASE_URL}/api/asistencia/clicks-by-hour`;
    const body: any = {
      client_id: getClientId()
    };

    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;

    const response = await fetch(url, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error en fetchAsistenciaClicksByHour: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de asistencia por hora');
    }

    return data.data || [];
  } catch (error) {
    // console.error('Error al obtener métricas de asistencia por hora:', error);
    throw error;
  }
}



// Obtener métricas de funnel (links -> clics -> asistencia webinar)
export async function fetchAsistenciaFunnelMetrics(params?: {
  region?: string;
  pais?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}): Promise<{
  success: boolean;
  filters_applied: {
    region: string | null;
    pais: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
  };
  totals: {
    total_links: number;
    total_clicks: number;
    total_attendance: number;
    total_links_unique: number;
    total_clicks_from_links: number;
    total_clicks_raw: number;
    total_attendance_from_clicks: number;
    total_attendance_from_links: number;
    pct_clicks_over_links: number;
    pct_attendance_over_clicks: number;
    pct_attendance_over_links: number;
  };
  funnel_by_phone: Array<{
    phone_norm: string;
    phone_examples: {
      links: string | null;
      asistencia: string | null;
      webinar: string | null;
    };
    has_link: boolean;
    has_click: boolean;
    has_webinar: boolean;
    campaña: string | null;
    region: string | null;
    pais: string | null;
  }>;
  no_match_records: Array<{
    source_table: string;
    phone_number: string | null;
    campaña: string | null;
    region: string | null;
    pais: string | null;
    reason: string;
    category?: string;
  }>;
}> {
  try {
    const body: any = {
      client_id: getClientId()
    };

    if (params?.region) body.region = params.region;
    if (params?.pais) body.pais = params.pais;
    if (params?.fecha_inicio) body.fecha_inicio = params.fecha_inicio;
    if (params?.fecha_fin) body.fecha_fin = params.fecha_fin;

    const response = await fetch(ASISTENCIA_FUNNEL_URL, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error en fetchAsistenciaFunnelMetrics: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener el funnel de asistencia');
    }
    return data;
  } catch (error) {
    // console.error('Error al obtener funnel de asistencia:', error);
    throw error;
  }
}



// Obtener llamadas por número de teléfono
export async function getCallsByPhone(
  params: {
    phone_number: string;
    per_page?: number;
    page?: number;
    sort_order?: 'ASC' | 'DESC' | 'asc' | 'desc' | 'ASCENDING' | 'DESCENDING';
  }
): Promise<CallsByPhoneResponse> {
  try {
    const url = `${BASE_URL}/api/calls/get-calls-by-phone`;
    const clientId = getClientId();
    const body = {
      phone_number: params.phone_number,
      per_page: params.per_page ?? 50,
      page: params.page ?? 1,
      sort_order: params.sort_order ?? 'DESC',
      // Enviar también el client_id para limitar la búsqueda en servidor
      ...(clientId ? { client_id: clientId } : {})
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en get-calls-by-phone: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: CallsByPhoneResponse = await response.json();
    return data;
  } catch (error) {
    // console.error('Error al obtener llamadas por teléfono:', error);
    throw error;
  }
}

export async function getCallTranscript(
  call_id: string
): Promise<{ transcript: string | null; recordings: string | null }> {
  const client_id = getClientId();
  if (!client_id) throw new Error('client_id no disponible');

  const response = await fetch(GET_CALL_TRANSCRIPT_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ call_id, client_id }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en get-call-transcript: ${response.status} - ${errorText}`);
  }

  return response.json();
}
