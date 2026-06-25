import { BASE_URL } from './config';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name: fullName.trim() }),
  });

  const data = (await response.json()) as UpdateProfileResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo actualizar el perfil');
  }

  return data;
}
