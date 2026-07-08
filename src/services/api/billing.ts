import { BASE_URL } from './config';
import { authHeaders } from './http';

// Facturación de la PLATAFORMA (suscripción del cliente a uMindsAI vía Stripe).
// No confundir con "facturación" de Ventas (revenue del negocio del cliente).

export type BillingPriceKind = 'monthly' | 'per_minute' | 'per_call' | 'per_whatsapp';

export interface BillingPrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  kind: BillingPriceKind;
  included_units: number | null;
}

export interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  prices: BillingPrice[];
}

export interface BillingSubscription {
  stripe_subscription_id: string;
  stripe_product_id: string | null;
  product_name: string | null;
  price_ids: { id: string; kind: 'monthly' | 'per_minute' }[];
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

export interface BillingInvoice {
  stripe_invoice_id: string;
  number: string | null;
  status: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at_stripe: string | null;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const err = await response.json().catch(() => ({}));
  return new Error(err.error || err.message || fallback);
}

export async function listBillingProducts(clientId: string): Promise<BillingProduct[]> {
  const response = await fetch(`${BASE_URL}/api/billing/available-plans`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) {
    throw await parseError(response, 'Error al cargar los planes');
  }
  const data = await response.json();
  const products: BillingProduct[] = Array.isArray(data.data) ? data.data : [];
  return products.filter((p) => p.prices && p.prices.length > 0);
}

export async function createBillingCheckout(clientId: string, productId: string): Promise<{ url: string }> {
  const response = await fetch(`${BASE_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId, product_id: productId }),
  });
  if (!response.ok) {
    throw await parseError(response, 'Error al iniciar el pago');
  }
  const data = await response.json();
  return data.data as { url: string };
}

export async function createBillingPortal(clientId: string): Promise<{ url: string }> {
  const response = await fetch(`${BASE_URL}/api/billing/portal`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) {
    throw await parseError(response, 'Error al abrir el portal de facturación');
  }
  const data = await response.json();
  return data.data as { url: string };
}

export async function getMyBillingSubscription(clientId: string): Promise<BillingSubscription | null> {
  const response = await fetch(`${BASE_URL}/api/billing/my-subscription`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) {
    throw await parseError(response, 'Error al cargar tu suscripción');
  }
  const data = await response.json();
  return (data.data as BillingSubscription) || null;
}

export async function getMyBillingInvoices(clientId: string): Promise<BillingInvoice[]> {
  const response = await fetch(`${BASE_URL}/api/billing/my-invoices`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) {
    throw await parseError(response, 'Error al cargar tus facturas');
  }
  const data = await response.json();
  return Array.isArray(data.data) ? (data.data as BillingInvoice[]) : [];
}
