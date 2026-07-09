import { BASE_URL, getClientId } from './config';
import { authHeaders } from './http';

const BASE = () => `${BASE_URL}/api/tokens`;

// El cliente activo del selector. El backend lo valida contra el token (requireClient):
// si el usuario no tiene permiso sobre él, responde 403. Se manda para que un usuario
// multi-cliente cree/liste los tokens del cliente que está viendo, no siempre el principal.
const clienteActivo = () => getClientId() || undefined;

export interface ApiToken {
  jti: string;
  name: string;
  scope: 'read' | 'write';
  created_at: string;
  created_by: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  activo: boolean;
}

/** Respuesta de la creación: `token` es lo ÚNICO que no se puede volver a ver. */
export interface CreatedApiToken {
  token: string;
  jti: string;
  name: string;
  scope: 'read';
  expires_at: string;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => ({}));
  throw new Error(data?.error || fallback);
}

export async function listApiTokens(): Promise<ApiToken[]> {
  const url = new URL(BASE());
  const clientId = clienteActivo();
  if (clientId) url.searchParams.set('client_id', clientId);

  const response = await fetch(url.toString(), { headers: await authHeaders(), cache: 'no-store' });
  if (!response.ok) await parseError(response, 'No se pudieron obtener los tokens');
  const data = await response.json();
  return Array.isArray(data.tokens) ? data.tokens : [];
}

export async function createApiToken(
  name: string,
  expiresInDays: number,
): Promise<CreatedApiToken> {
  const response = await fetch(BASE(), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ name, expiresInDays, client_id: clienteActivo() }),
  });
  if (!response.ok) await parseError(response, 'No se pudo crear el token');
  return response.json();
}

export async function revokeApiToken(jti: string): Promise<void> {
  const url = new URL(`${BASE()}/${encodeURIComponent(jti)}`);
  const clientId = clienteActivo();
  if (clientId) url.searchParams.set('client_id', clientId);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) await parseError(response, 'No se pudo revocar el token');
}
