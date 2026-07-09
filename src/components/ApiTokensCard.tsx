import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import {
  ApiToken,
  CreatedApiToken,
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "../services/api/apiTokens";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const EXPIRACIONES = [
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
  { label: "180 días", value: 180 },
  { label: "1 año", value: 365 },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Estado legible de un token: revocado / vencido / activo. */
function estadoDe(token: ApiToken): { texto: string; clase: string } {
  if (token.revoked_at) {
    return { texto: "Revocado", clase: "bg-slate-100 text-slate-600" };
  }
  if (new Date(token.expires_at).getTime() <= Date.now()) {
    return { texto: "Vencido", clase: "bg-amber-100 text-amber-700" };
  }
  return { texto: "Activo", clase: "bg-emerald-100 text-emerald-700" };
}

export function ApiTokensCard() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dias, setDias] = useState(90);

  // El token recién creado. Se muestra UNA sola vez: el backend no lo guarda.
  const [nuevoToken, setNuevoToken] = useState<CreatedApiToken | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setTokens(await listApiTokens());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar los tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleCrear = async () => {
    if (!nombre.trim()) {
      toast.error("Poné un nombre para reconocer el token");
      return;
    }
    setCreating(true);
    try {
      const creado = await createApiToken(nombre.trim(), dias);
      setNuevoToken(creado);
      setCopiado(false);
      setShowForm(false);
      setNombre("");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el token");
    } finally {
      setCreating(false);
    }
  };

  const handleRevocar = async (token: ApiToken) => {
    const ok = window.confirm(
      `¿Revocar "${token.name}"?\n\nCualquier integración que lo esté usando va a dejar de funcionar de inmediato. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setRevoking(token.jti);
    try {
      await revokeApiToken(token.jti);
      toast.success("Token revocado");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo revocar el token");
    } finally {
      setRevoking(null);
    }
  };

  const handleCopiar = async () => {
    if (!nuevoToken) return;
    try {
      await navigator.clipboard.writeText(nuevoToken.token);
      setCopiado(true);
      toast.success("Token copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar. Seleccionalo y copialo a mano.");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <KeyRound className="w-5 h-5 text-slate-400" />
            Tokens de API
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Generá un token para leer tus datos desde otro sistema (un CRM, n8n, etc.).
            Son de <strong>solo lectura</strong> y solo acceden a los datos de tu cuenta.
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#05163b] hover:bg-[#0a2456] text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo token
          </Button>
        )}
      </div>

      {/* Token recién creado: única oportunidad de copiarlo */}
      {nuevoToken && (
        <div className="mx-6 mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Copialo ahora: no vas a poder verlo de nuevo
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Por seguridad no guardamos el token. Si lo perdés, revocá este y creá otro.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded border border-amber-300 bg-white px-3 py-2 font-mono text-xs text-slate-800">
                  {nuevoToken.token}
                </code>
                <Button
                  onClick={() => void handleCopiar()}
                  className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <p className="text-xs text-amber-800 mt-3">
                Usalo así:{" "}
                <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>
              </p>

              <button
                onClick={() => setNuevoToken(null)}
                className="mt-3 text-xs font-medium text-amber-900 underline"
              >
                Ya lo guardé, ocultar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de creación */}
      {showForm && (
        <div className="mx-6 mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="token-name" className="text-sm font-medium text-slate-700">
              Nombre
            </label>
            <Input
              id="token-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Ej: Export a HubSpot"
              className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
            />
            <p className="text-xs text-slate-500">Para reconocerlo después en esta lista.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="token-exp" className="text-sm font-medium text-slate-700">
              Vence en
            </label>
            <select
              id="token-exp"
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EXPIRACIONES.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setNombre("");
              }}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCrear()}
              disabled={creating || !nombre.trim()}
              className="bg-[#05163b] hover:bg-[#0a2456] text-white"
            >
              {creating ? "Creando..." : "Crear token"}
            </Button>
          </div>
        </div>
      )}

      {/* Listado */}
      <div className="px-6 py-6">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando tokens...</p>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8">
            <KeyRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Todavía no generaste ningún token.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 pr-4 font-medium">Creado</th>
                  <th className="pb-2 pr-4 font-medium">Vence</th>
                  <th className="pb-2 pr-4 font-medium">Último uso</th>
                  <th className="pb-2 font-medium sr-only">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tokens.map((token) => {
                  const estado = estadoDe(token);
                  return (
                    <tr key={token.jti}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{token.name}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{formatDate(token.created_at)}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatDate(token.expires_at)}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {token.last_used_at ? formatDate(token.last_used_at) : "Nunca"}
                      </td>
                      <td className="py-3 text-right">
                        {!token.revoked_at && (
                          <button
                            onClick={() => void handleRevocar(token)}
                            disabled={revoking === token.jti}
                            title="Revocar token"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {revoking === token.jti ? "Revocando..." : "Revocar"}
                          </button>
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
  );
}
