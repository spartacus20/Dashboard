import { supabase } from '../../lib/supabase';

// Helper compartido para autenticar las llamadas al backend con el token de Supabase.
// El backend deriva el client_id del token (el client_id del body/query se sigue
// enviando por el selector multi-cliente, pero se valida contra el token).
// A medida que se protejan más endpoints (plan de seguridad), cada servicio de
// services/api debe usar authHeaders() en vez de headers estáticos.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
