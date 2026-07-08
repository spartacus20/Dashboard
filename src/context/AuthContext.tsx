import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import {
  supabase,
  getClientId,
  get_client_id,
  selected_client_id,
  clearSessionData,
  setClientId,
  updateClientSubscriptionStatus,
} from "../lib/supabase";
import { getClientApiKey } from "../api";
import { updateAccountPassword } from "../services/api/account";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signInWithProvider: (
    provider: "google" | "github",
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error: Error | null }>;
  changeClientId: (newClientId: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Función para recuperar datos del usuario (incluyendo permissions)
    const restoreUserData = async (email: string) => {
      try {
        // Siempre recuperar los datos del servidor cuando hay una sesión activa
        // Esto asegura que los permissions estén siempre actualizados y correctos
        // especialmente importante después de un refresh donde sessionStorage puede estar vacío o incorrecto
        // console.log('🔄 Recuperando datos del usuario desde el servidor (sesión activa detectada)...')
        await getClientId(email);

        // Verificar que se guardaron correctamente
        const savedPermissions = sessionStorage.getItem("permissions");
        if (savedPermissions) {
          try {
            const parsed = JSON.parse(savedPermissions);
            // console.log('✅ Permissions recuperados y guardados correctamente:', parsed)
          } catch (e) {
            // console.warn('⚠️ Error parseando permissions guardados:', e)
          }
        } else {
          // console.warn('⚠️ No se pudieron guardar permissions en sessionStorage')
        }
      } catch (err) {
        // console.warn('No se pudo recuperar los datos del usuario:', err)
      }
    };

    // Obtener la sesión inicial
    const getInitialSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        // console.error('Error obteniendo sesión:', error)
      } else {
        setSession(session);
        setUser(session?.user ?? null);

        // Si hay una sesión activa, recuperar los datos del usuario (incluyendo permissions)
        if (session?.user?.email) {
          await restoreUserData(session.user.email);
        }
      }
      setLoading(false);
    };

    getInitialSession();

    // Escuchar cambios en la autenticación.
    // IMPORTANTE: nunca tocamos `loading` aquí. El loading solo existe durante
    // getInitialSession (primera carga). Cualquier evento posterior (SIGNED_IN por
    // renovación de sesión, TOKEN_REFRESHED, etc.) se maneja en silencio para no
    // desmontar el dashboard ni cerrar modales abiertos.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (
        event === "SIGNED_IN" &&
        session?.user?.email
      ) {
        // Actualizar datos del cliente en background (sin spinner)
        // TOKEN_REFRESHED se omite intencionalmente: solo refresca el JWT, no requiere
        // re-fetchear datos del usuario. Hacerlo resetearía metadata/apiKey al cliente base.
        try {
          await getClientId(session.user.email);
        } catch {
          // silencioso
        }

        if (event === "SIGNED_IN") {
          try {
            localStorage.setItem("dashboard_time_period", "today");
          } catch {}
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        clearSessionData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Si el login es exitoso, obtener el client_id de get-client
    if (!error) {
      try {
        await getClientId(email);
      } catch (err) {
        // console.warn("No se pudo obtener el client_id de get-client:", err);
      }

      // Establecer filtro por defecto del dashboard a "today" en login con email/contraseña
      try {
        localStorage.setItem("dashboard_time_period", "today");
      } catch {}
    }

    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    // Si el registro es exitoso, guardar la contraseña encriptada en la tabla users
    if (!error) {
      try {
        await updateAccountPassword(email, password);
      } catch {
        // No retornamos error: el usuario ya se creó en Supabase
      }
    }

    return { error };
  };

  const signInWithProvider = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignorar: sesión inválida/expirada, limpiamos local de todos modos
    }
    setSession(null);
    setUser(null);
    localStorage.removeItem(get_client_id);
    localStorage.removeItem("selected_client_id");
    clearSessionData();
    return { error: null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ error: Error | null }> => {
    const email = user?.email;
    if (!email) {
      return { error: new Error("No hay sesión activa") };
    }

    if (newPassword.length < 8) {
      return {
        error: new Error("La nueva contraseña debe tener al menos 8 caracteres"),
      };
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) {
      return { error: new Error("La contraseña actual es incorrecta") };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      return {
        error: new Error(
          updateError.message || "No se pudo actualizar la contraseña",
        ),
      };
    }

    try {
      await updateAccountPassword(email, newPassword);
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err
            : new Error("No se pudo guardar la contraseña en el sistema"),
      };
    }

    return { error: null };
  };

  const changeClientId = async (newClientId: string) => {
    try {
      // console.log("🔄 AuthContext - Cambiando client_id a:", newClientId);

      // Guardar el client_id seleccionado en localStorage (persistente)
      localStorage.setItem("selected_client_id", newClientId);

      // Actualizar el client_id en localStorage y sessionStorage
      setClientId(newClientId);
      sessionStorage.setItem("clientId", newClientId);
      // console.log(
      //   "✅ AuthContext - client_id seleccionado guardado en localStorage y sessionStorage",
      // );

      // Actualizar estado de suscripción y API key en paralelo,
      // esperar ambas antes de disparar clientIdChanged
      const [, result] = await Promise.all([
        updateClientSubscriptionStatus(newClientId).catch(() => {}),
        getClientApiKey(newClientId),
      ]);
      // console.log("📋 AuthContext - Resultado de getClientApiKey:", {
      //   hasApiKey: !!result.apiKey,
      //   hasApiKeyTest: !!result.apiKeyTest,
      //   apiKeyTestLength: result.apiKeyTest?.length || 0,
      //   hasConfig: !!result.config,
      //   clientId: result.clientId,
      // });

      // Usar apiKeyTest si está disponible, sino usar apiKey
      if (result.apiKeyTest && result.apiKeyTest.length > 0) {
        // console.log(
        //   `📞 AuthContext - Usando ${result.apiKeyTest.length} API keys de api_key_test`,
        // );
        // Chunk 13a: la key NO se persiste en sessionStorage; viaja solo en el
        // evento clientIdChanged (memoria) hacia CallsContext.

        // Disparar evento personalizado para notificar el cambio de client_id
        const eventDetail = {
          clientId: newClientId,
          apiKey: result.apiKeyTest[0], // Usar la primera para compatibilidad
          apiKeyTest: result.apiKeyTest, // Incluir el array completo
          config: result.config,
        };
        // console.log(
        //   "📢 AuthContext - Disparando evento clientIdChanged con:",
        //   eventDetail,
        // );
        window.dispatchEvent(
          new CustomEvent("clientIdChanged", {
            detail: eventDetail,
          }),
        );

        return { error: null };
      } else if (result.apiKey) {
        // Chunk 13a: la key NO se persiste en sessionStorage (solo va en el evento).

        // Disparar evento personalizado para notificar el cambio de client_id
        const eventDetail = {
          clientId: newClientId,
          apiKey: result.apiKey,
          config: result.config,
        };
        // console.log(
        //   "📢 AuthContext - Disparando evento clientIdChanged con:",
        //   eventDetail,
        // );
        window.dispatchEvent(
          new CustomEvent("clientIdChanged", {
            detail: eventDetail,
          }),
        );

        return { error: null };
      } else {
        throw new Error(
          "No se pudo obtener la API key para el nuevo client_id",
        );
      }
    } catch (error) {
      // console.error("❌ AuthContext - Error al cambiar client_id:", error);
      return {
        error:
          error instanceof Error
            ? error
            : new Error("Error desconocido al cambiar client_id"),
      };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithProvider,
    signOut,
    resetPassword,
    changePassword,
    changeClientId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
