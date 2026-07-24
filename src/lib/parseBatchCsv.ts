// Parser de CSV para campañas programadas.
// La columna de teléfono se DETECTA automáticamente (en cualquier posición) por
// dos señales: (1) el nombre del encabezado (phone_number, phone, teléfono,
// celular…) y (2) el contenido (celdas que "parecen" teléfonos). El resto de
// columnas se convierten en dynamic_variables de cada llamada.
//   - 1 columna candidata  → se usa automáticamente.
//   - 2+ candidatas (ambiguo, ej. "telefono" y "whatsapp") → el modal muestra un
//     selector para que el usuario elija cuál es el número a llamar.
//   - 0 candidatas → el modal ofrece elegir manualmente entre todas las columnas.
// Elegida la columna, se renombra internamente a "phone_number" para que Retell y
// la vista previa la reciban con el nombre correcto, sin editar el CSV.

export interface BatchTaskInput {
  to_number: string;
  dynamic_variables?: Record<string, string>;
}

export interface CsvColumn {
  index: number;   // índice en el CSV original
  header: string;  // encabezado original (trim)
  sample: string;  // primer valor no vacío de esa columna
}

export interface PhoneColumnCandidate extends CsvColumn {
  byHeader: boolean;       // el encabezado matchea un alias de teléfono
  phoneLikeRatio: number;  // fracción de celdas que parecen teléfono (0-1)
}

export interface ParsedBatchCsv {
  tasks: BatchTaskInput[];
  headers: string[];               // encabezados de salida: [phone_number, ...resto]
  error?: string;
  needsSelection?: boolean;        // true → el usuario debe elegir la columna de teléfono
  candidates?: PhoneColumnCandidate[]; // columnas que parecen teléfono (para el selector)
  columns?: CsvColumn[];           // todas las columnas (para elegir manualmente)
  phoneColIndex?: number;          // índice (en el CSV original) usado como teléfono
}

const PHONE_HEADER = 'phone_number';

// Alias aceptados para el encabezado de la columna de teléfono, en su forma
// normalizada (minúsculas, sin acentos, separadores colapsados a un espacio).
const PHONE_HEADER_ALIASES = new Set<string>([
  'phone number', 'phone', 'phonenumber',
  'number', 'numero', 'num',
  'telefono', 'tel', 'telephone',
  'celular', 'cel',
  'movil', 'mobile',
  'whatsapp', 'wa',
  'to number', 'to',
  'msisdn',
  'x',
]);

// Umbral de contenido: si al menos el 70% de las celdas no vacías de una columna
// parecen teléfonos, se considera columna candidata aunque el nombre no lo diga.
const PHONE_CONTENT_RATIO = 0.7;

// Cuántas filas de datos se muestrean para inferir por contenido.
const CONTENT_SAMPLE_ROWS = 50;

function stripBom(s: string): string {
  return String(s).replace(/^﻿/, '');
}

// Normaliza un encabezado para compararlo contra PHONE_HEADER_ALIASES.
// Ej: "Phone_Number" -> "phone number", "Teléfono" -> "telefono".
function normalizeHeader(raw: string): string {
  return stripBom(String(raw))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // quita acentos (telefono)
    .toLowerCase()
    .replace(/[\s._/-]+/g, ' ')             // separadores -> un solo espacio
    .trim();
}

// Caracteres invisibles de dirección de texto (bidi) que rompen los números
// cuando el CSV viene de Excel/WhatsApp — se eliminan de los teléfonos.
const BIDI_RE = /[‎‏‪-‮⁦-⁩﻿]/g;

export function sanitizePhone(raw: string): string {
  return String(raw).replace(BIDI_RE, '').trim();
}

// ¿El valor de una celda parece un número de teléfono? Solo +, dígitos y
// separadores comunes, con 7 a 15 dígitos (rango E.164 razonable).
function looksLikePhone(raw: string): boolean {
  const s = sanitizePhone(raw);
  if (!s) return false;
  if (!/^\+?[\d\s().-]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// Parser CSV mínimo (campos entre comillas, comillas escapadas como "").
export function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    const trimmed = row.map((cell) => String(cell).trim());
    if (trimmed.some((cell) => cell !== '')) rows.push(trimmed);
    row = [];
    field = '';
  };

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',' || c === ';') {
      // soporta separador coma y punto y coma (Excel es-ES exporta con ";")
      row.push(field);
      field = '';
    } else if (c === '\n' || (c === '\r' && next === '\n')) {
      pushRow();
      if (c === '\r') i++;
    } else if (c === '\r') {
      pushRow();
    } else {
      field += c;
    }
  }
  pushRow();

  return rows;
}

// Lista todas las columnas con su encabezado y un valor de ejemplo.
export function listColumns(rows: string[][]): CsvColumn[] {
  if (!rows.length) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return headers.map((h, c) => {
    let sample = '';
    for (let r = 0; r < Math.min(dataRows.length, CONTENT_SAMPLE_ROWS); r++) {
      const v = String(dataRows[r]?.[c] ?? '').trim();
      if (v) { sample = v; break; }
    }
    return { index: c, header: stripBom(String(h ?? '')).trim(), sample };
  });
}

// Detecta las columnas que parecen teléfono (por nombre y/o contenido), ordenadas
// por relevancia (primero las que matchean por nombre, luego por ratio de contenido).
export function detectPhoneColumns(rows: string[][]): PhoneColumnCandidate[] {
  if (!rows.length) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const sampleN = Math.min(dataRows.length, CONTENT_SAMPLE_ROWS);

  const candidates: PhoneColumnCandidate[] = [];
  for (let c = 0; c < headers.length; c++) {
    const header = stripBom(String(headers[c] ?? '')).trim();
    const byHeader = PHONE_HEADER_ALIASES.has(normalizeHeader(header));

    let nonEmpty = 0;
    let phoneLike = 0;
    let sample = '';
    for (let r = 0; r < sampleN; r++) {
      const v = String(dataRows[r]?.[c] ?? '').trim();
      if (!v) continue;
      nonEmpty++;
      if (!sample) sample = v;
      if (looksLikePhone(v)) phoneLike++;
    }
    const ratio = nonEmpty ? phoneLike / nonEmpty : 0;

    if (byHeader || ratio >= PHONE_CONTENT_RATIO) {
      candidates.push({ index: c, header, sample, byHeader, phoneLikeRatio: ratio });
    }
  }

  candidates.sort(
    (a, b) => (Number(b.byHeader) - Number(a.byHeader)) || (b.phoneLikeRatio - a.phoneLikeRatio),
  );
  return candidates;
}

// Construye las tasks usando la columna `phoneColIndex` como teléfono. El resto de
// columnas (en su orden original) se emiten como dynamic_variables.
export function rowsToBatchTasks(rows: string[][], phoneColIndex: number): ParsedBatchCsv {
  if (!rows.length) {
    return { tasks: [], headers: [], error: 'El CSV está vacío.' };
  }

  const rawHeaders = rows[0].map((h) => stripBom(String(h ?? '')).trim());
  const columns = listColumns(rows);

  if (phoneColIndex < 0 || phoneColIndex >= rawHeaders.length) {
    return { tasks: [], headers: [], columns, error: 'La columna de teléfono seleccionada no es válida.' };
  }

  const restIndices = rawHeaders.map((_, i) => i).filter((i) => i !== phoneColIndex);
  const restHeaders = restIndices.map((i, k) => rawHeaders[i] || `columna_${k + 1}`);

  // El resto de columnas no puede duplicarse ni chocar con "phone_number".
  const seen = new Set<string>([PHONE_HEADER]);
  for (const h of restHeaders) {
    if (seen.has(h)) {
      return { tasks: [], headers: [], columns, error: `Columna duplicada o en conflicto con phone_number: "${h}".` };
    }
    seen.add(h);
  }

  const outHeaders = [PHONE_HEADER, ...restHeaders];

  const tasks: BatchTaskInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const to_number = sanitizePhone(cells[phoneColIndex] ?? '');
    if (!to_number) continue;

    const dynamic_variables: Record<string, string> = {};
    for (let k = 0; k < restIndices.length; k++) {
      const key = restHeaders[k];
      const val = String(cells[restIndices[k]] ?? '').trim();
      if (val !== '') dynamic_variables[key] = val;
    }

    tasks.push({
      to_number,
      ...(Object.keys(dynamic_variables).length ? { dynamic_variables } : {}),
    });
  }

  if (!tasks.length) {
    return { tasks: [], headers: outHeaders, columns, error: 'No hay filas con número válido en la columna de teléfono seleccionada.' };
  }

  return { tasks, headers: outHeaders, columns, phoneColIndex };
}

// Punto de entrada. Sin `phoneColIndex` intenta autodetectar:
//   - 1 candidata → parsea sola.
//   - 2+ o 0 candidatas → devuelve needsSelection para que el usuario elija.
// Con `phoneColIndex` fuerza esa columna como teléfono.
export function parseBatchCsv(text: string, phoneColIndex?: number): ParsedBatchCsv {
  const rows = parseCSV(text);
  if (!rows.length) {
    return { tasks: [], headers: [], error: 'El CSV está vacío.' };
  }

  if (typeof phoneColIndex === 'number') {
    return rowsToBatchTasks(rows, phoneColIndex);
  }

  const candidates = detectPhoneColumns(rows);
  if (candidates.length === 1) {
    return rowsToBatchTasks(rows, candidates[0].index);
  }

  // Ambiguo (2+) o sin detectar (0): el usuario elige la columna.
  return {
    tasks: [],
    headers: [],
    needsSelection: true,
    candidates,
    columns: listColumns(rows),
  };
}
