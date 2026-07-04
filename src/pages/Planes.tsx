import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, ExternalLink, FileText, Receipt } from "lucide-react";
import { useCallsContext } from "../context/CallsContext";
import {
  BillingInvoice,
  BillingProduct,
  BillingSubscription,
  createBillingCheckout,
  createBillingPortal,
  getMyBillingInvoices,
  getMyBillingSubscription,
  listBillingProducts,
} from "../services/api/billing";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

// Etiquetas por unidad de cobro por uso (kinds del backend de billing)
const USAGE_UNIT_DISPLAY: Record<string, { singular: string; plural: string }> = {
  per_minute: { singular: "min", plural: "min" },
  per_call: { singular: "llamada", plural: "llamadas" },
  per_whatsapp: { singular: "mensaje WhatsApp", plural: "mensajes WhatsApp" },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents === null || cents === undefined) return "—";
  const amount = (cents / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = (currency || "eur").toUpperCase() === "EUR" ? "€" : (currency || "").toUpperCase();
  return `${amount} ${symbol}`;
}

function subscriptionStatusBadge(status: string) {
  if (status === "active" || status === "trialing") {
    return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">Activa</span>;
  }
  if (status === "past_due") {
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Pago pendiente</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">Cancelada</span>;
}

function invoiceStatusBadge(status: string | null) {
  if (status === "paid") {
    return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">Pagada</span>;
  }
  if (status === "open") {
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Pendiente</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">{status || "—"}</span>;
}

export function Planes() {
  const { clientId } = useCallsContext();

  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const hasActiveSubscription =
    subscription !== null && ACTIVE_STATUSES.includes(subscription.status);

  const loadData = useCallback(async () => {
    if (!clientId) return;
    try {
      const [productsData, subscriptionData, invoicesData] = await Promise.all([
        listBillingProducts(clientId),
        getMyBillingSubscription(clientId),
        getMyBillingInvoices(clientId),
      ]);
      setProducts(productsData);
      setSubscription(subscriptionData);
      setInvoices(invoicesData);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron cargar los planes",
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Retorno de Stripe Checkout (?checkout=success|cancelled)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;

    window.history.replaceState({}, "", "/dashboard/planes");

    if (checkout === "success") {
      toast.success("¡Suscripción completada! Puede tardar unos segundos en reflejarse.");
      // El webhook es asíncrono: reintentar la carga a los 4s
      const timer = setTimeout(() => {
        void loadData();
      }, 4000);
      return () => clearTimeout(timer);
    }
    if (checkout === "cancelled") {
      toast.error("El pago fue cancelado");
    }
  }, [loadData]);

  const handleSubscribe = async (productId: string) => {
    if (!clientId) {
      toast.error("No se pudo identificar tu cuenta");
      return;
    }
    setSubscribingTo(productId);
    try {
      const { url } = await createBillingCheckout(clientId, productId);
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo iniciar el pago",
      );
      setSubscribingTo(null);
    }
  };

  const handleOpenPortal = async () => {
    if (!clientId) {
      toast.error("No se pudo identificar tu cuenta");
      return;
    }
    setOpeningPortal(true);
    try {
      const { url } = await createBillingPortal(clientId);
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo abrir el portal",
      );
      setOpeningPortal(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
        Planes y facturación
      </h1>
      <p className="text-slate-600 mb-8">
        Gestiona tu suscripción y consulta tus facturas.
      </p>

      {/* Tu plan actual */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Tu plan actual</h2>
          <p className="text-sm text-slate-500 mt-1">
            Estado de tu suscripción a la plataforma.
          </p>
        </div>
        <div className="px-6 py-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : subscription && hasActiveSubscription ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-base font-semibold text-slate-900">
                    {subscription.product_name || "Plan contratado"}
                  </p>
                  {subscriptionStatusBadge(subscription.status)}
                </div>
                <p className="text-sm text-slate-600 mt-1.5">
                  Próxima renovación: {formatDate(subscription.current_period_end)}
                </p>
                {subscription.cancel_at_period_end && (
                  <p className="text-sm text-amber-700 mt-1">
                    Tu plan se cancelará el {formatDate(subscription.current_period_end)}.
                  </p>
                )}
              </div>
              <Button
                onClick={() => void handleOpenPortal()}
                disabled={openingPortal}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {openingPortal ? "Abriendo..." : "Gestionar suscripción"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No tienes ningún plan activo. Elige uno de los planes disponibles para empezar.
            </p>
          )}
        </div>
      </div>

      {/* Planes disponibles */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Planes disponibles</h2>
          <p className="text-sm text-slate-500 mt-1">
            Suscríbete al plan que mejor se adapte a tu uso.
          </p>
        </div>
        <div className="px-6 py-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aún no tienes planes asignados. Contacta con soporte para configurar tu plan.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => {
                const monthly = product.prices.find((p) => p.kind === "monthly");
                const usagePrices = product.prices.filter((p) => p.kind !== "monthly");
                const isCurrent =
                  hasActiveSubscription &&
                  subscription?.stripe_product_id === product.id;

                return (
                  <div
                    key={product.id}
                    className="rounded-lg border border-slate-200 p-5 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                      {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200 shrink-0">
                          Plan actual
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-slate-500 mt-1">{product.description}</p>
                    )}
                    <div className="mt-4 space-y-1 flex-1">
                      {monthly && (
                        <p className="text-slate-900">
                          <span className="text-2xl font-bold">
                            {formatAmount(monthly.unit_amount, monthly.currency)}
                          </span>
                          <span className="text-sm text-slate-500"> /mes</span>
                        </p>
                      )}
                      {usagePrices.map((price) => {
                        const unit = USAGE_UNIT_DISPLAY[price.kind] || USAGE_UNIT_DISPLAY.per_minute;
                        return price.included_units ? (
                          <div key={price.id} className="text-sm text-slate-600 space-y-0.5">
                            <p>
                              Incluye {price.included_units.toLocaleString("es-ES")} {unit.plural}/mes
                            </p>
                            <p className="text-slate-500">
                              Excedente: {formatAmount(price.unit_amount, price.currency)} por {unit.singular}
                            </p>
                          </div>
                        ) : (
                          <p key={price.id} className="text-sm text-slate-600">
                            + {formatAmount(price.unit_amount, price.currency)} por {unit.singular}
                          </p>
                        );
                      })}
                      {!monthly && usagePrices.length > 0 && (
                        <p className="text-xs text-slate-500">
                          Sin cuota fija: pagas solo por el uso de cada mes.
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => void handleSubscribe(product.id)}
                      disabled={hasActiveSubscription || subscribingTo !== null}
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full mt-5"
                    >
                      {subscribingTo === product.id ? "Redirigiendo..." : "Suscribirse"}
                    </Button>
                    {hasActiveSubscription && !isCurrent && (
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        Cancela tu plan actual para cambiar de plan.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Historial de facturas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Historial de facturas</h2>
          <p className="text-sm text-slate-500 mt-1">
            Descarga tus facturas en PDF.
          </p>
        </div>
        <div className="px-6 py-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Receipt className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-600">Todavía no tienes facturas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Número</th>
                    <th className="pb-3 pr-4 font-semibold">Importe</th>
                    <th className="pb-3 pr-4 font-semibold">Estado</th>
                    <th className="pb-3 font-semibold text-right">Factura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => {
                    const pdfUrl = invoice.invoice_pdf || invoice.hosted_invoice_url;
                    return (
                      <tr key={invoice.stripe_invoice_id}>
                        <td className="py-3 pr-4 text-slate-700">
                          {formatDate(invoice.created_at_stripe)}
                        </td>
                        <td className="py-3 pr-4 text-slate-700 font-mono text-xs">
                          {invoice.number || "—"}
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {formatAmount(
                            invoice.status === "paid" ? invoice.amount_paid : invoice.amount_due,
                            invoice.currency,
                          )}
                        </td>
                        <td className="py-3 pr-4">{invoiceStatusBadge(invoice.status)}</td>
                        <td className="py-3 text-right">
                          {pdfUrl ? (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
