import { get_client_id } from '../../lib/supabase';

// Obtener la URL base según el entorno
export const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION_API === 'true';
export const BASE_PROD = import.meta.env.VITE_BASE_PROD;
export const BASE_DEV = import.meta.env.VITE_BASE_DEV;
export const BASE_URL = IS_PRODUCTION ? BASE_PROD : BASE_DEV;

export const WEBHOOK_URL = BASE_URL;
export const GET_CLIENT_WEBHOOK_URL = `${BASE_URL}/get-client`;
export const GET_DASHBOARD_WEBHOOK_URL = `${BASE_URL}/api/dashboard/get-dashboard`;
export const GET_DASHBOARD_CUSTOM_WEBHOOK_URL = `${BASE_URL}/api/dashboard/get-dashboard-custom`;
export const GET_AGENDAS_WEBHOOK_URL =  `${BASE_URL}/api/agenda/get-agenda`;
export const DELETE_AGENDA_WEBHOOK_URL = `${BASE_URL}/api/agenda/delete`;
export const AVERAGE_CALLS_PER_AGENDA_URL = `${BASE_URL}/api/agenda/average-calls-per-agenda`;
export const MOTIVOS_RECHAZO_URL = `${BASE_URL}/api/agenda/motivos-rechazo`;
export const API_URL = 'https://api.retellai.com/v2/list-calls';
export const ASISTENCIA_FUNNEL_URL = `${BASE_URL}/api/asistencia/funnel`;

// Función helper para obtener el client_id del localStorage
export function getClientId(): string | null {
  return localStorage.getItem(get_client_id);
}
