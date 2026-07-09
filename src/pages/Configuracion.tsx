import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Lock, Mail, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getAccountCreatedAt,
  getCurrentUserInfo,
  getEmail,
  getFullName,
  isClientActive,
  persistAccountCreatedAt,
  setFullName,
} from "../lib/supabase";
import { fetchAccountProfile, updateProfileName } from "../services/api/account";
import { ApiTokensCard } from "../components/ApiTokensCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

function formatAccountDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function Configuracion() {
  const { user, changePassword } = useAuth();
  const sessionEmail = getEmail() || user?.email || "";
  const initialName = getFullName() || getCurrentUserInfo().name || "";
  const usesEmailAuth =
    user?.identities?.some((identity) => identity.provider === "email") ?? true;

  const [fullName, setFullNameInput] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [activeSince, setActiveSince] = useState<string | null>(
    getAccountCreatedAt(),
  );
  const [saving, setSaving] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const accountActive = isClientActive();
  const hasChanges = fullName.trim() !== savedName.trim();
  const canSubmitPasswordChange =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0;

  useEffect(() => {
    if (!sessionEmail) return;

    let cancelled = false;

    const refreshAccountData = async () => {
      setLoadingAccount(true);
      try {
        const profile = await fetchAccountProfile(sessionEmail);
        if (cancelled) return;

        const refreshedCreatedAt = persistAccountCreatedAt({
          fullName: profile.fullName,
          created_at: profile.createdAt,
        });

        if (profile.fullName) {
          setFullNameInput(profile.fullName);
          setSavedName(profile.fullName);
        }

        if (refreshedCreatedAt) {
          setActiveSince(refreshedCreatedAt);
          return;
        }

        const cachedCreatedAt = getAccountCreatedAt();
        if (cachedCreatedAt) {
          setActiveSince(cachedCreatedAt);
        }
      } catch {
        if (cancelled) return;
        const cachedCreatedAt = getAccountCreatedAt();
        if (cachedCreatedAt) {
          setActiveSince(cachedCreatedAt);
        }
      } finally {
        if (!cancelled) {
          setLoadingAccount(false);
        }
      }
    };

    void refreshAccountData();

    return () => {
      cancelled = true;
    };
  }, [sessionEmail]);

  const handleSave = async () => {
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      toast.error("El nombre no puede estar vacío");
      return;
    }

    if (!sessionEmail) {
      toast.error("No se pudo identificar tu cuenta");
      return;
    }

    setSaving(true);
    try {
      const result = await updateProfileName(sessionEmail, trimmedName);
      const updatedName = result.data?.fullName || trimmedName;

      setFullName(updatedName);
      setFullNameInput(updatedName);
      setSavedName(updatedName);

      if (result.data?.created_at) {
        setActiveSince(result.data.created_at);
      }

      toast.success("Nombre actualizado correctamente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el nombre",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("La nueva contraseña debe ser distinta a la actual");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await changePassword(currentPassword, newPassword);
      if (error) {
        toast.error(error.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada correctamente");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
        Configuración
      </h1>
      <p className="text-slate-600 mb-8">
        Gestiona los datos básicos de tu cuenta.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Tu cuenta</h2>
          <p className="text-sm text-slate-500 mt-1">
            Información vinculada a tu acceso al dashboard.
          </p>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="account-name"
              className="flex items-center gap-2 text-sm font-medium text-slate-700"
            >
              <User className="w-4 h-4 text-slate-400" />
              Nombre
            </label>
            <Input
              id="account-name"
              value={fullName}
              onChange={(e) => setFullNameInput(e.target.value)}
              maxLength={120}
              placeholder="Tu nombre"
              className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
            />
            <p className="text-xs text-slate-500">
              Se muestra en el menú lateral y en la interfaz del dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="account-email"
              className="flex items-center gap-2 text-sm font-medium text-slate-700"
            >
              <Mail className="w-4 h-4 text-slate-400" />
              Correo electrónico
            </label>
            <Input
              id="account-email"
              value={sessionEmail}
              readOnly
              disabled
              className="bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500">
              Para cambiar tu correo electrónico, contacta con un administrador.
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Activa desde
                </p>
                <p className="text-sm text-slate-900 mt-0.5">
                  {loadingAccount && !activeSince
                    ? "Cargando..."
                    : formatAccountDate(activeSince)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Estado actual:{" "}
                  <span
                    className={
                      accountActive
                        ? "text-green-700 font-medium"
                        : "text-amber-700 font-medium"
                    }
                  >
                    {accountActive ? "Activa" : "Inactiva o vencida"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <Button
            onClick={() => void handleSave()}
            disabled={!hasChanges || saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Seguridad</h2>
          <p className="text-sm text-slate-500 mt-1">
            Actualiza la contraseña de acceso al dashboard.
          </p>
        </div>

        {usesEmailAuth ? (
          <>
            <div className="px-6 py-6 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="current-password"
                  className="flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  Contraseña actual
                </label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="new-password"
                  className="text-sm font-medium text-slate-700"
                >
                  Nueva contraseña
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
                />
                <p className="text-xs text-slate-500">Mínimo 8 caracteres.</p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirm-password"
                  className="text-sm font-medium text-slate-700"
                >
                  Confirmar nueva contraseña
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button
                onClick={() => void handlePasswordChange()}
                disabled={!canSubmitPasswordChange || changingPassword}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {changingPassword ? "Actualizando..." : "Cambiar contraseña"}
              </Button>
            </div>
          </>
        ) : (
          <div className="px-6 py-6">
            <p className="text-sm text-slate-600">
              Tu cuenta usa inicio de sesión externo. Para cambiar la contraseña,
              contacta con un administrador.
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Ancho completo: la tabla de tokens necesita más espacio que las tarjetas de arriba */}
      <div className="mt-6">
        <ApiTokensCard />
      </div>
    </div>
  );
}
