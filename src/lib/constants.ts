/**
 * Constantes centralizadas de la aplicación.
 *
 * Punto único de verdad para valores que antes estaban hardcodeados y
 * repartidos por las páginas (tamaños de paginación, paletas de gráficos,
 * configuración de regiones, endpoints externos, etc.).
 *
 * Al migrar valores aquí preservamos EXACTAMENTE los valores previos para no
 * introducir cambios de comportamiento. La unificación semántica de paletas de
 * color (varios arrays con orden ligeramente distinto) queda pendiente de un
 * pase de design tokens — por eso de momento conviven varias paletas.
 */

// ─── Paginación ─────────────────────────────────────────────────────────────
// Cada página tenía su propio tamaño de página con nombres distintos.
export const AGENDAS_PAGE_SIZE = 10;
export const CALLBACKS_PAGE_SIZE = 25;
export const CAMPAIGN_PAGE_SIZE = 50;
export const PHONES_PAGE_SIZE = 25;
export const INTERESADOS_PAGE_SIZE = 50;
export const INTERESADOS_EXPORT_PAGE_SIZE = 100;
export const RECORDINGS_PAGE_SIZE = 25;
export const RECORDINGS_PAGE_SIZE_OPTIONS = [25, 50, 100];

// ─── Duraciones / umbrales ──────────────────────────────────────────────────
/** Duración mínima (ms) para considerar una llamada como "interesado". */
export const INTERESADOS_MIN_DURATION_MS = 60_000;

// ─── Tipo de cambio (Presupuesto) ─────────────────────────────────────────────
/** Tasa USD→EUR de respaldo cuando fallan las APIs externas. */
export const EXCHANGE_RATE_FALLBACK = 0.92;
/** Timeout (ms) para abortar el fetch de cada API de tipo de cambio. */
export const EXCHANGE_RATE_TIMEOUT_MS = 6000;

// ─── Telefonía ────────────────────────────────────────────────────────────────
/** Hosts de terminación SIP por defecto al importar números. */
export const DEFAULT_TERMINATION_URIS = [
  'livekit.netelip.com',
  'livekit2.netelip.com',
  'livekit3.netelip.com',
  'livekit4.netelip.com',
];

// ─── Paletas de gráficos ──────────────────────────────────────────────────────
/** Paleta general recomendada para gráficos nuevos. */
export const CHART_COLORS = [
  '#3b82f6', // azul
  '#10b981', // verde
  '#f59e0b', // ámbar
  '#8b5cf6', // violeta
  '#ef4444', // rojo
  '#ec4899', // rosa
  '#14b8a6', // teal
  '#f97316', // naranja
];

/** Paleta usada por el gráfico de identidad del Dashboard. */
export const IDENTIDAD_COLORS = [
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

// ─── Regiones / países (Lanzamiento) ──────────────────────────────────────────
export const REGION_OPTIONS = [
  { region: 'España' },
  { region: 'Europa' },
  { region: 'Latam' },
];

export const REGION_PAISES: { region: string; paises: string }[] = [
  { region: 'España', paises: 'España' },
  { region: 'Europa', paises: 'no_detectado' },
  {
    region: 'Latam',
    paises:
      'Argentina, Bolivia, Brasil, Chile, Colombia, Costa Rica, Cuba, Ecuador, El Salvador, México, Nicaragua, Panamá, Paraguay, Perú, República Dominicana, Uruguay, USA / Canadá, Venezuela',
  },
];

export const COUNTRY_FLAGS: Record<string, string> = {
  España: '🇪🇸',
  Argentina: '🇦🇷',
  México: '🇲🇽',
  Colombia: '🇨🇴',
  Chile: '🇨🇱',
  Perú: '🇵🇪',
  Brasil: '🇧🇷',
  Venezuela: '🇻🇪',
  Ecuador: '🇪🇨',
  'República Dominicana': '🇩🇴',
  Uruguay: '🇺🇾',
  Paraguay: '🇵🇾',
  Bolivia: '🇧🇴',
  'Costa Rica': '🇨🇷',
  Panamá: '🇵🇦',
  Nicaragua: '🇳🇮',
  'El Salvador': '🇸🇻',
  Guatemala: '🇬🇹',
  Honduras: '🇭🇳',
  Cuba: '🇨🇺',
  Haití: '🇭🇹',
  Curazao: '🇨🇼',
  Guyana: '🇬🇾',
  Surinam: '🇸🇷',
  'Guayana Francesa': '🇬🇫',
  'USA / Canadá': '🇺🇸',
  'Reino Unido': '🇬🇧',
  Alemania: '🇩🇪',
  Francia: '🇫🇷',
  Italia: '🇮🇹',
  Irlanda: '🇮🇪',
  Portugal: '🇵🇹',
  'Países Bajos': '🇳🇱',
  Bélgica: '🇧🇪',
  no_detectado: '🌐',
};
