// Lista compartida de zonas horarias IANA para selectores de la app (antes
// duplicada casi-idéntica en BatchCallingTab.tsx y CreateBatchCampaignModal.tsx).

export const COMMON_TIMEZONES = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'America/Phoenix',
  'UTC',
];

// Zona horaria del navegador, priorizada primero en la lista (sin duplicarla
// si ya está en COMMON_TIMEZONES).
export function timezoneOptionsWithDetected(): string[] {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [...new Set([detected, ...COMMON_TIMEZONES])];
}
