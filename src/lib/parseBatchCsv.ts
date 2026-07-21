// Parser de CSV para campañas programadas (portado del front viejo del batch service).
// Regla: la primera columna DEBE llamarse "phone_number"; el resto de columnas
// se convierten en dynamic_variables de cada llamada.

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

// Caracteres invisibles de dirección de texto (bidi) que rompen los números
// cuando el CSV viene de Excel/WhatsApp — se eliminan de los teléfonos.
const BIDI_RE = /[‎‏‪-‮⁦-⁩﻿]/g;

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

  const headers = rows[0].map((h) => h.replace(/^﻿/, '').trim());
  if (!headers.length || headers[0].toLowerCase() !== PHONE_HEADER) {
    return {
      tasks: [],
      headers: [],
      error: `La primera columna debe llamarse "${PHONE_HEADER}" (cabecera de la primera columna).`,
    };
  }

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
