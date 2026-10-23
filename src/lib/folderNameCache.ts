/**
 * Cache de nombres de folders (workspace names) vinculados a API keys de Retell.
 *
 * Seguridad: las API keys NUNCA se almacenan. Se usa un hash SHA-256 truncado
 * como clave del cache. El valor almacenado (nombre de carpeta) no es sensible.
 *
 * TTL: 24 horas. Pasado ese tiempo la entrada se considera stale y se re-fetcha.
 */

const STORAGE_KEY = 'retell_folder_names_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

interface CacheEntry {
  name: string;
  cachedAt: number;
}

type CacheStore = Record<string, CacheEntry>;

async function hashKey(apiKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(apiKey);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24); // 24 hex chars son suficientes para evitar colisiones
}

function readStore(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CacheStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage lleno o no disponible — silencioso
  }
}

/** Devuelve el nombre cacheado si existe y no está expirado, o null en caso contrario. */
export async function getCachedFolderName(apiKey: string): Promise<string | null> {
  const hash = await hashKey(apiKey);
  const store = readStore();
  const entry = store[hash];
  if (entry && Date.now() - entry.cachedAt < TTL_MS) {
    return entry.name;
  }
  return null;
}

/** Guarda el nombre de folder asociado al hash de la API key. */
export async function setCachedFolderName(apiKey: string, name: string): Promise<void> {
  const hash = await hashKey(apiKey);
  const store = readStore();
  store[hash] = { name, cachedAt: Date.now() };
  writeStore(store);
}

/** Invalida la entrada de una API key específica (fuerza re-fetch en la próxima carga). */
export async function invalidateCachedFolderName(apiKey: string): Promise<void> {
  const hash = await hashKey(apiKey);
  const store = readStore();
  delete store[hash];
  writeStore(store);
}

/** Limpia todo el cache de nombres de folders. */
export function clearFolderNameCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silencioso
  }
}
