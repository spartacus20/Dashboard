// Parser de CSV para campañas programadas (portado del front viejo del batch service).
// Regla: la PRIMERA columna es el teléfono; el resto de columnas se convierten en
// dynamic_variables de cada llamada. El encabezado de la primera columna se acepta
// bajo varios alias (phone_number, phone, number, teléfono, celular…) y se renombra
// internamente a "phone_number" para que Retell lo reciba bien — sin que el usuario
// tenga que renombrar nada en su CSV.

export interface BatchTaskInput {
  to_number: string;
  dynamic_variables?: Record<string, string>;
}

export interface ParsedBatchCsv {
  tasks: BatchTaskInput[];
  headers: string[];
  error?: string;
}

const PHONE_HEADER = 'phone_number';

// Alias aceptados para el encabezado de la primera columna, en su forma normalizada
// (minúsculas, sin acentos, y separadores _ - . / espacios colapsados a un espacio).
// Cualquiera de estos se trata como la columna de teléfono y se renombra a PHONE_HEADER.
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

// Normaliza un encabezado para compararlo contra PHONE_HEADER_ALIASES.
// Ej: "Phone_Number" -> "phone number", "Telefono" -> "telefono".
function normalizeHeader(raw: string): string {
  return String(raw)
    .replace(/^\uFEFF/, '')                 // BOM
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // quita acentos (telefono -> telefono)
    .toLowerCase()
    .replace(/[\s._/-]+/g, ' ')             // separadores -> un solo espacio
    .trim();
}

// Caracteres invisibles de dirección de texto (bidi) que rompen los números
// cuando el CSV viene de Excel/WhatsApp — se eliminan de los teléfonos.
const BIDI_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function sanitizePhone(raw: string): string {
  return String(raw).replace(BIDI_RE, '').trim();
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

// Valida cabecera y devuelve tasks { to_number, dynamic_variables? }[].
export function rowsToBatchTasks(rows: string[][]): ParsedBatchCsv {
  if (!rows.length) {
    return { tasks: [], headers: [], error: 'El CSV está vacío.' };
  }

  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  if (!headers.length || !PHONE_HEADER_ALIASES.has(normalizeHeader(headers[0] ?? ''))) {
    return {
      tasks: [],
      headers: [],
      error: `La primera columna debe ser el teléfono. Nómbrala "${PHONE_HEADER}" (también se aceptan "phone", "number", "teléfono", "celular"…). Encabezado detectado: "${headers[0] ?? ''}".`,
    };
  }

  // Renombrado interno: pase lo que pase, la primera columna viaja como phone_number
  // (así Retell y la vista previa la reciben con el nombre correcto, sin que el
  // usuario tenga que editar su CSV).
  headers[0] = PHONE_HEADER;

  const rest = headers.slice(1);
  const seen = new Set<string>();
  for (const h of rest) {
    if (!h) continue;
    if (seen.has(h)) {
      return { tasks: [], headers, error: `Columna duplicada: "${h}".` };
    }
    seen.add(h);
  }

  const tasks: BatchTaskInput[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const to_number = sanitizePhone(cells[0] ?? '');
    if (!to_number) continue;

    const dynamic_variables: Record<string, string> = {};
    for (let c = 1; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const val = String(cells[c] ?? '').trim();
      if (val !== '') dynamic_variables[key] = val;
    }

    tasks.push({
      to_number,
      ...(Object.keys(dynamic_variables).length ? { dynamic_variables } : {}),
    });
  }

  if (!tasks.length) {
    return {
      tasks: [],
      headers,
      error: 'No hay filas con número válido. Añade al menos una fila con teléfono en la columna phone_number.',
    };
  }

  return { tasks, headers };
}

export function parseBatchCsv(text: string): ParsedBatchCsv {
  return rowsToBatchTasks(parseCSV(text));
}
