import { BASE_URL, GET_CLIENT_WEBHOOK_URL } from './config';
import { authHeaders } from './http';

export interface AccountProfile {
  fullName: string;
  createdAt: string | null;
}

export async function fetchAccountProfile(email: string): Promise<AccountProfile> {
  const response = await fetch(GET_CLIENT_WEBHOOK_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar la información de la cuenta');
  }

  const data = await response.json();
  const profile = Array.isArray(data) ? data[0] : data;

  return {
    fullName: profile?.fullName || profile?.full_name || '',
    createdAt: profile?.created_at || profile?.createdAt || null,
  };
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    email: string;
    fullName: string;
    full_name: string;
    created_at?: string | null;
    updated_at?: string | null;
  };
  error?: string;
}

export async function updateProfileName(
  email: string,
  fullName: string,
): Promise<UpdateProfileResponse> {
  const response = await fetch(`${BASE_URL}/api/users/update-profile`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ email, full_name: fullName.trim() }),
  });

  const data = (await response.json()) as UpdateProfileResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo actualizar el perfil');
  }

  return data;
}

export interface UpdateTimezoneResponse {
  success: boolean;
  message?: string;
  data?: { timezone: string };
  error?: string;
}

// Preferencia PERSONAL del usuario autenticado (no del cliente activo) — rige
// en qué zona horaria ve sus datos, sin importar a qué cliente cambie.
export async function updateMyTimezone(timezone: string): Promise<UpdateTimezoneResponse> {
  const response = await fetch(`${BASE_URL}/api/users/update-timezone`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ timezone }),
  });

  const data = (await response.json()) as UpdateTimezoneResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo actualizar la zona horaria');
  }

  return data;
}

export interface UpdatePasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function updateAccountPassword(
  email: string,
  password: string,
): Promise<UpdatePasswordResponse> {
  const response = await fetch(`${BASE_URL}/api/users/update-password`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as UpdatePasswordResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo actualizar la contraseña');
  }

  return data;
}
