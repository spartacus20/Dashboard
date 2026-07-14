import { forceRefreshAccessToken, getFreshAccessToken } from '../../lib/supabase';

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

/**
 * fetch autenticado con reintento ante 401.
 *
 * Última red de seguridad: si el token muere entre que armamos los headers y el servidor
 * lo valida (o si el auto-refresh de supabase-js nos ganó de mano y nos quedamos con uno
 * viejo), forzamos una renovación y repetimos la request UNA sola vez.
 *
 * Reintentar ante 401 es seguro incluso en POST: un 401 significa que el backend rechazó
 * la request antes de procesarla, así que no se duplica nada.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const conToken = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  });

  const respuesta = await fetch(url, conToken(await getFreshAccessToken()));
  if (respuesta.status !== 401) return respuesta;

  const tokenNuevo = await forceRefreshAccessToken();
  if (!tokenNuevo) return respuesta; // la sesión murió de verdad: que el 401 llegue arriba

  return fetch(url, conToken(tokenNuevo));
}
