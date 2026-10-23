import type { BatchTaskInput } from './parseBatchCsv';
import type { CallshiftContactInput } from '../services/api/callshift';

// Convierte las filas del CSV (ya parseadas por parseBatchCsv) en contactos de
// CallShift: nombre y apellido van a firstName/lastName y TODAS las demás columnas
// a metadata, que viaja al prompt del agente y vuelve intacta en cada llamada.
//
// Teléfonos: E.164 estricto. A diferencia del flujo de Retell, a un número sin código
// de país NO se le antepone "+" a ciegas ("612345678" sería otro país): se usa el
// prefijo que indique el usuario o se descarta.

const E164 = /^\+[1-9]\d{6,14}$/;

const normalizeKey = (h: string) =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');

const FIRST_NAME_KEYS = new Set(['nombre', 'first name', 'firstname', 'name', 'nombres']);
const LAST_NAME_KEYS = new Set(['apellido', 'apellidos', 'last name', 'lastname', 'surname']);

export type PhoneProblem = 'sin_prefijo' | 'invalido';

export interface ConvertedContacts {
  contacts: CallshiftContactInput[];
  rejected: { row: number; phone: string; problem: PhoneProblem }[];
  firstNameColumn: string | null;
  lastNameColumn: string | null;
}

export function normalizeE164(raw: string, defaultPrefix: string): { phone: string | null; problem?: PhoneProblem } {
  const compact = (raw || '').trim().replace(/[\s\-().]/g, '');
  if (!compact) return { phone: null, problem: 'invalido' };

  let phone: string;
  if (compact.startsWith('+')) phone = compact;
  else if (compact.startsWith('00')) phone = `+${compact.slice(2)}`;
  else {
    const prefix = defaultPrefix.trim().replace(/[^\d+]/g, '');
    if (!prefix) return { phone: null, problem: 'sin_prefijo' };
    phone = `${prefix.startsWith('+') ? prefix : `+${prefix}`}${compact}`;
  }
  return E164.test(phone) ? { phone } : { phone: null, problem: 'invalido' };
}

export function toCallshiftContacts(tasks: BatchTaskInput[], defaultPrefix: string): ConvertedContacts {
  const headers = new Set<string>();
  tasks.forEach((t) => Object.keys(t.dynamic_variables ?? {}).forEach((k) => headers.add(k)));
  const firstNameColumn = [...headers].find((h) => FIRST_NAME_KEYS.has(normalizeKey(h))) ?? null;
  const lastNameColumn = [...headers].find((h) => LAST_NAME_KEYS.has(normalizeKey(h))) ?? null;

  const contacts: CallshiftContactInput[] = [];
  const rejected: ConvertedContacts['rejected'] = [];

  tasks.forEach((task, i) => {
    const { phone, problem } = normalizeE164(task.to_number, defaultPrefix);
    if (!phone) {
      rejected.push({ row: i + 1, phone: task.to_number, problem: problem ?? 'invalido' });
      return;
    }
    const vars = { ...(task.dynamic_variables ?? {}) };
    const first = firstNameColumn ? vars[firstNameColumn] : undefined;
    const last = lastNameColumn ? vars[lastNameColumn] : undefined;
    if (firstNameColumn) delete vars[firstNameColumn];
    if (lastNameColumn) delete vars[lastNameColumn];

    contacts.push({
      phone_number: phone,
      ...(first ? { first_name: first } : {}),
      ...(last ? { last_name: last } : {}),
      ...(Object.keys(vars).length ? { metadata: vars } : {}),
    });
  });

  return { contacts, rejected, firstNameColumn, lastNameColumn };
}
