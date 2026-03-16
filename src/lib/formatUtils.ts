import type { DetailedRetellCall } from '../types';

export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return 'Desconocido';
  let processed = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
  return processed.replace(/\+(\d{2})(\d{3})(\d{3})(\d{3})/, '+$1 $2 $3 $4');
}

export function getDuration(call: DetailedRetellCall): string {
  if (call.disconnection_reason === 'dial_failed' || call.disconnection_reason === 'machine_detected') {
    return '0:00';
  }
  const durationMs = call.duration_ms || call.duration || 0;
  if (!durationMs) return '0:00';
  const totalSeconds = Math.floor(durationMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatCost(cost: number): string {
  if (cost === undefined || cost === null) return '$0.00';
  return `$${(cost / 100).toFixed(2)}`;
}
