import { BASE_URL } from './config';
import { authHeaders } from './http';
import type { Ticket } from '../../types';

export async function fetchTickets(clientId: string): Promise<Ticket[]> {
  if (!clientId) throw new Error('client_id es requerido');
  const response = await fetch(`${BASE_URL}/api/tickets/list?client_id=${encodeURIComponent(clientId)}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener tickets: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const data = await response.json();
  return data.tickets || [];
}

export async function createTicket(payload: {
  client_id: string;
  title: string;
  description: string;
  responsible: string;
}): Promise<Ticket> {
  const response = await fetch(`${BASE_URL}/api/tickets/create`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear ticket: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const data = await response.json();
  return data.ticket as Ticket;
}

export async function updateTicket(payload: {
  id: number;
  client_id: string;
  title: string;
  description: string;
  responsible: string;
  state?: string;
}): Promise<Ticket> {
  const response = await fetch(`${BASE_URL}/api/tickets/update`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar ticket: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const data = await response.json();
  return data.ticket as Ticket;
}

export async function deleteTicket(ticketId: number, clientId: string): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/api/tickets/delete?id=${encodeURIComponent(ticketId)}&client_id=${encodeURIComponent(clientId)}`,
    { method: 'DELETE', headers: await authHeaders() }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al eliminar ticket: ${response.status} ${response.statusText} - ${errorText}`);
  }
}
