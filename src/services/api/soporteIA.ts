import { BASE_URL } from './config';

export interface ZinkeeListaValor {
  id: number;
  valor: string;
  valorCalc?: string | null;
  colorAsignado?: string | null;
}

export interface ZinkeeCampo {
  id: number;
  nombre: string;
  mantId: number;
  mantNombre?: string;
  tipo: string;
  descripcion?: string;
  valores?: ZinkeeListaValor[];
  obligatorio?: boolean;
  editable?: boolean;
  unico?: boolean;
  [key: string]: unknown;
}

export interface ZinkeeSkeletonData {
  campos?: ZinkeeCampo[];
  [key: string]: unknown;
}

export interface FetchSoporteIASkeletonOptions {
  mantId?: number;
  vistaId?: number | null;
  kanbanId?: number | null;
  /** Solo para depuración: token ya obtenido (el backend usa env por defecto) */
  authToken?: string;
  appId?: string;
}

export async function fetchSoporteIASkeleton(
  options: FetchSoporteIASkeletonOptions = {},
): Promise<ZinkeeSkeletonData> {
  const response = await fetch(`${BASE_URL}/api/soporte-ia/skeleton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mantId: options.mantId,
      vistaId: options.vistaId,
      kanbanId: options.kanbanId,
      authToken: options.authToken,
      appId: options.appId,
    }),
  });

  const raw = await response.text();
  let json: { success?: boolean; data?: ZinkeeSkeletonData; error?: string; details?: unknown };
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Respuesta no JSON (${response.status}): ${raw.slice(0, 200)}`);
  }

  if (!response.ok) {
    const msg =
      json.error ||
      (typeof json.details === 'string' ? json.details : null) ||
      `Error ${response.status}`;
    throw new Error(
      msg.length > 200 ? msg.slice(0, 200) + '…' : String(msg),
    );
  }

  if (!json.success || !json.data) {
    const msg = json.error || 'Respuesta inválida del backend';
    throw new Error(msg);
  }

  return json.data;
}

// ---- Registros (mant/registro/list) ----

export interface ZinkeeRegistroDataCell {
  campoId: number;
  valor: unknown;
  valorRel: string | null;
  valorCalc?: number | null;
  valorCalcFixed?: number | null;
}

export interface ZinkeeRegistroFila {
  id: number;
  mensajesPendientes?: number;
  mencionado?: boolean;
  tieneMensajes?: boolean;
  tieneAdjuntos?: boolean;
  data: ZinkeeRegistroDataCell[];
}

export interface FetchSoporteIARegistrosOptions {
  mantId?: number;
  pagNum?: number;
  /**
   * Omite la prop para usar el confGrid por defecto del backend.
   * Pasa `null` para la petición con confGrid: null (p. ej. mant 174).
   */
  confGrid?: unknown | null;
  mantVistaId?: number | null;
  mantKanbanId?: number | null;
  regsIds?: unknown;
  authToken?: string;
  appId?: string;
}

export async function fetchSoporteIARegistros(
  options: FetchSoporteIARegistrosOptions = {},
): Promise<ZinkeeRegistroFila[]> {
  const payload: Record<string, unknown> = {
    pagNum: options.pagNum,
    mantVistaId: options.mantVistaId,
    mantKanbanId: options.mantKanbanId,
    regsIds: options.regsIds,
    authToken: options.authToken,
    appId: options.appId,
  };
  if (options.mantId != null) payload.mantId = options.mantId;
  if (Object.prototype.hasOwnProperty.call(options, 'confGrid')) {
    payload.confGrid = options.confGrid;
  }

  const response = await fetch(`${BASE_URL}/api/soporte-ia/registros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let json: {
    success?: boolean;
    data?: ZinkeeRegistroFila[];
    error?: string;
    details?: unknown;
  };
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Respuesta no JSON (${response.status}): ${raw.slice(0, 200)}`);
  }

  if (!response.ok) {
    const msg =
      json.error ||
      (typeof json.details === 'string' ? json.details : null) ||
      `Error ${response.status}`;
    throw new Error(
      String(msg).length > 200 ? String(msg).slice(0, 200) + '…' : String(msg),
    );
  }

  if (!json.success) {
    throw new Error(json.error || 'Respuesta inválida del backend');
  }

  if (!Array.isArray(json.data)) {
    return [];
  }

  return json.data;
}

/** Orden y anchos alineados con zinkeeDefaultRegConfGrid (solo columnas de datos) */
export const SOPORTE_IA_COLUMNA_ORDER: number[] = [
  4088, 4106, 4091, 4092, 4093, 4094, 4095, 4109, 4107,
];

/** Anchos en px (table-fixed). ID / estado / prioridad más compactos; el texto largo va en 4106 y con truncate. */
export const SOPORTE_IA_COLUMNA_WIDTHS: Record<number, number> = {
  4088: 68,
  4106: 320,
  4091: 150,
  4092: 80,
  4093: 150,
  4094: 150,
  4095: 100,
  4109: 88,
  4107: 180,
};

/** Mants Zinkee (Soporte IA) */
export const SOPORTE_IA_MANT_INCIDENCIAS = 173;
export const SOPORTE_IA_MANT_FICHAS = 174;

/** En detalle incidencias: fecha creación, usuario creador (no en tabla) */
export const SOPORTE_IA_CAMPO_FECHA = 4086;
export const SOPORTE_IA_CAMPO_USUARIO = 4087;
export const SOPORTE_IA_CAMPO_MOTIVO = 4092;
export const SOPORTE_IA_CAMPO_ID_INCIDENCIA = 4088;
export const SOPORTE_IA_CAMPO_ID_FICHA = 4098;

/** Columnas visibles · mant 174 (confGrid null en la API) */
export const SOPORTE_IA_FICHAS_COLUMNA_ORDER: number[] = [
  4098, 4100, 4101, 4102, 4103, 4104, 4105, 4097,
];

export const SOPORTE_IA_FICHAS_COLUMNA_WIDTHS: Record<number, number> = {
  4098: 100,
  4100: 150,
  4101: 120,
  4102: 130,
  4103: 200,
  4104: 100,
  4105: 100,
  4097: 150,
};
