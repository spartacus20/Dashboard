import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import {
  supabase,
  getClientId,
  get_client_id,
  selected_client_id,
  clearSessionData,
  setClientId,
} from "../lib/supabase";
import { getClientApiKey } from "../api";

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

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Si hay una nueva sesión (login exitoso o sesión restaurada), obtener el client_id
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.user?.email
      ) {
        try {
          await getClientId(session.user.email);
        } catch (err) {
          // console.warn('No se pudo obtener el client_id de get-client:', err)
        }

        // Establecer filtro por defecto del dashboard a "today" solo en nuevo login
        if (event === "SIGNED_IN") {
          try {
            localStorage.setItem("dashboard_time_period", "today");
          } catch {}
        }
      }

      // Si se cerró sesión, limpiar datos
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
        // Obtener la URL base del backend
        const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION_API === "true";
        const BASE_PROD = import.meta.env.VITE_BASE_PROD;
        const BASE_DEV = import.meta.env.VITE_BASE_DEV;
        const BASE_URL = IS_PRODUCTION ? BASE_PROD : BASE_DEV;

        // Llamar al endpoint para actualizar la contraseña en la tabla users
        const response = await fetch(`${BASE_URL}/api/users/update-password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          // console.warn(
            // "⚠️ No se pudo guardar la contraseña en la tabla users:",
            // errorData,
          // );
          // No retornamos error aquí porque el usuario ya se creó en Supabase
          // Solo registramos la advertencia
        } else {
          // console.log("✅ Contraseña guardada exitosamente en la tabla users");
        }
      } catch (err) {
        // console.warn(
        //   "⚠️ Error al guardar la contraseña en la tabla users:",
        //   err,
        // );
        // No retornamos error aquí porque el usuario ya se creó en Supabase
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
    const { error } = await supabase.auth.signOut();

    // Limpiar el client_id del localStorage al cerrar sesión
    if (!error) {
      localStorage.removeItem(get_client_id);
      localStorage.removeItem("selected_client_id"); // También limpiar el client_id seleccionado
      // Limpiar todos los datos del sessionStorage
      clearSessionData();
      // console.log(
      //   "Client ID eliminado del localStorage y sessionStorage al cerrar sesión",
      // );
    }

    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
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

      // Obtener la nueva API key y configuración para el nuevo client_id
      // console.log(
      //   "🔄 AuthContext - Obteniendo API key para nuevo client_id...",
      // );
      const result = await getClientApiKey(newClientId);
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
        // Guardar la primera API key en sessionStorage para compatibilidad
        sessionStorage.setItem("apiKey", result.apiKeyTest[0]);
        // Guardar el array completo de apiKeyTest en sessionStorage
        sessionStorage.setItem("apiKeyTest", JSON.stringify(result.apiKeyTest));
        // console.log(
        //   "✅ AuthContext - API keys actualizadas para nuevo client_id",
        // );

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
        sessionStorage.setItem("apiKey", result.apiKey);
        // console.log(
        //   "✅ AuthContext - API key actualizada para nuevo client_id",
        // );

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
    changeClientId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
