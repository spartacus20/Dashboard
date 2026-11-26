import { AlertTriangle, Coins, PauseCircle } from "lucide-react";
import { useCallsContext } from "../context/CallsContext";
import { useCredits } from "../hooks/useCredits";
import { CREDITS_MOVEMENT_DAYS, CreditsMovement } from "../services/api/credits";

const numberFormat = new Intl.NumberFormat("es-AR");

const formatCredits = (value: number): string => numberFormat.format(value);

// "+5.000" / "-2.100" / "0"
const formatSigned = (value: number): string =>
  value > 0 ? `+${formatCredits(value)}` : formatCredits(value);

// `day` viene como YYYY-MM-DD ya en la zona del navegador: se arma la fecha local sin
// pasar por UTC para que no se corra un día.
function formatDay(day: string): string {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return day;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function movementTitle(mv: CreditsMovement): string {
  if (mv.kind === "usage") {
    const parts = ["Consumo"];
    if (mv.calls != null) parts.push(`${formatCredits(mv.calls)} llamada${mv.calls === 1 ? "" : "s"}`);
    if (mv.duration_ms != null) parts.push(`${formatCredits(Math.round(mv.duration_ms / 60000))} min`);
    return parts.join(" · ");
  }
  return mv.kind === "grant" ? "Carga de créditos" : "Ajuste";
}

/**
 * Saldo de créditos prepago y movimientos recientes. No renderiza nada si el cliente
 * no tiene créditos (o mientras carga / si falla el pedido).
 */
export function CreditsCard() {
  const { clientId } = useCallsContext();
  const { credits } = useCredits(clientId);
  if (!credits) return null;

  const balance = credits.balance_credits;
  const empty = balance <= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Coins className="w-5 h-5 text-slate-400" />
          Créditos
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Cada llamada descuenta créditos según su duración.
        </p>
      </div>

      <div className="px-6 py-6 space-y-6">
        {credits.blocked && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
            <span>
              Sin créditos: no se pueden lanzar llamadas y las campañas en curso se pausaron.
              Contactá a soporte para recargar.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Saldo disponible</p>
            <p className={`text-4xl font-bold tabular-nums ${empty ? "text-red-600" : "text-slate-900"}`}>
              {formatCredits(balance)}
              <span className="ml-2 text-base font-medium text-slate-500">créditos</span>
            </p>
          </div>
          <div className="space-y-1 text-sm text-slate-600">
            <p>≈ {formatCredits(Math.max(0, credits.approx_minutes))} minutos de llamada</p>
            <p>Tarifa: {formatCredits(credits.rate_per_minute)} créditos por minuto</p>
          </div>
        </div>

        {credits.paused_campaigns.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <p className="flex items-center gap-2 font-medium">
              <PauseCircle className="w-4 h-4 shrink-0" />
              Campañas pausadas por falta de créditos
            </p>
            <ul className="mt-1 ml-6 list-disc">
              {credits.paused_campaigns.map((c) => (
                <li key={`${c.provider}:${c.campaign_id}`}>{c.campaign_name || c.campaign_id}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-orange-700">
              Al recargar no se reanudan solas: reanudalas desde Campañas.
            </p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Movimientos de los últimos {CREDITS_MOVEMENT_DAYS} días
          </h3>
          {credits.movements.length === 0 ? (
            <p className="text-sm text-slate-500">No hay movimientos en este período.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {credits.movements.map((mv, i) => (
                <li key={`${mv.kind}:${mv.day}:${mv.created_at}:${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{movementTitle(mv)}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {formatDay(mv.day)}
                      {mv.kind !== "usage" && mv.note ? ` · ${mv.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      mv.credits < 0 ? "text-red-600" : mv.credits > 0 ? "text-emerald-700" : "text-slate-600"
                    }`}
                  >
                    {formatSigned(mv.credits)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
