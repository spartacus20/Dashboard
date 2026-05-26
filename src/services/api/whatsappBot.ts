import { WHATSAPP_BOT_STATS_URL } from './config';

export type WhatsappBotPeriod = 'today' | 'week' | 'month' | 'all';

export interface WhatsappBotStatsRow {
  client_id: string;
  total: number;
}

export interface WhatsappBotStatsResponse {
  success: boolean;
  period: WhatsappBotPeriod;
  total_clients: number;
  data: WhatsappBotStatsRow[];
}

/**
 * Obtiene el total de mensajes de whatsapp_bot para un client_id y período dados.
 * Devuelve 0 si no hay datos o si ocurre un error.
 */
export async function fetchWhatsappBotStats(
  clientId: string,
  period: WhatsappBotPeriod = 'all',
): Promise<{ total: number; period: WhatsappBotPeriod }> {
  if (!clientId) return { total: 0, period };

  const url = new URL(WHATSAPP_BOT_STATS_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('period', period);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`WhatsApp Bot Stats error: ${res.status}`);

  const json: WhatsappBotStatsResponse = await res.json();
  const row = json.data?.find((r) => r.client_id === clientId);

  return { total: row?.total ?? 0, period };
}
