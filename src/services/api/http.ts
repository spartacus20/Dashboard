import { getFreshAccessToken } from '../../lib/supabase';

// Helper compartido para autenticar las llamadas al backend con el token de Supabase.
// El backend deriva el client_id del token (el client_id del body/query se sigue
// enviando por el selector multi-cliente, pero se valida contra el token).
// Usa getFreshAccessToken() para nunca mandar un access_token vencido (evita el 401 en
// la carrera del F5, cuando CallsContext pide datos antes de que termine el refresh).
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getFreshAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
