import { BASE_URL } from './config';
import { authedFetch } from './http';

// 'unknown' = no se pudo averiguar (backend caído, red cortada). NO es un estado del
// servidor: lo devolvemos para que el gate de ProtectedRoute deje pasar en vez de acusar
// a un usuario legítimo de estar pendiente de aprobación por un problema de red.
//
// Dejar pasar es seguro: la pantalla de pendientes es UX, no un control de acceso. El
// aislamiento real lo hace requireClient en el backend, que devuelve 403 en todos los
// endpoints mientras el usuario no tenga un client_id asignado.
export type AccountStatus = 'active' | 'pending' | 'unknown';

export async function fetchAccountStatus(): Promise<AccountStatus> {
  try {
    const response = await authedFetch(`${BASE_URL}/api/account/me/status`, {
      method: 'GET',
      // no-store: es estado de sesión — un 304 con body viejo dejaría al usuario en la
      // pantalla de pendiente después de que el admin ya lo habilitó.
      cache: 'no-store',
    });

    if (!response.ok) return 'unknown';

    const data = await response.json();
    return data?.status === 'active' ? 'active' : 'pending';
  } catch {
    return 'unknown';
  }
}
