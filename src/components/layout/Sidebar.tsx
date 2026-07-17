import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Wallet,
  Mic,
  Menu,
  X,
  Key,
  Phone,
  PhoneOutgoing,
  Calendar,
  PhoneCall,
  LogOut,
  TrendingUp,
  Rocket,
  PhoneOff,
  Megaphone,
  ClipboardList,
  RotateCcw,
  BotMessageSquare,
  Users,
  ChevronDown,
  Search,
  PhoneForwarded,
  BrainCircuit,
  Settings,
  CreditCard,
  MoreVertical,
} from "lucide-react";
import { useCallsContext } from "../../context/CallsContext";
import { useAuth } from "../../context/AuthContext";
import {
  hasLaunchPermissions,
  canAccess,
  canAccessTickets,
  canAccessRecoveries,
  canAccessAssistantIA,
  canAccessHydro,
  canAccessSeguimientos,
  canAccessBudget,
  canAccessAgentes,
  hasPermissionsDefined,
  getClientTest,
  getClientIdFromSession,
  getFullName,
  getUserData,
  getEmail,
} from "../../lib/supabase";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  cacheStatus?: string;
  isLoading?: boolean;
}

export function Sidebar({
  currentPage,
  onPageChange,
  cacheStatus,
  isLoading,
}: SidebarProps) {
  const {
    loadingProgress,
    totalCalls,
    loadingAllCalls,
    loadingDashboardData,
    apiKey,
    apiKeyTest,
    agendaEnabled,
    salesEnabled,
    numTelEnabled,
    recordsEnabled,
    callbacksEnabled,
    launchEnabled,
    dontCallEnabled,
    campaignEnabled,
    loadAllCalls,
    loadDashboardData,
    loadPhoneNumbers,
    loadBatchCalls,
  } = useCallsContext();
  const { user, signOut, changeClientId } = useAuth();
  const progressPercentage =
    totalCalls > 0
      ? Math.min(100, Math.round((loadingProgress / totalCalls) * 100))
      : 0;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showBatchCall, setShowBatchCall] = useState(false);
  const [availableClientIds, setAvailableClientIds] = useState<string[]>([]);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [isChangingClient, setIsChangingClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState(
    () => sessionStorage.getItem("fullName") || "",
  );
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setIsClientDropdownOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Verificar si el usuario tiene permissions definidos
  const hasPermissions = hasPermissionsDefined();

  // Si tiene permissions, usar permissions. Si no, usar los flags del contexto (metadata)
  const canAccessAgenda = hasPermissions ? canAccess("agenda") : agendaEnabled;
  const canAccessRecords = hasPermissions
    ? canAccess("records")
    : recordsEnabled;
  const canAccessNumTel = hasPermissions ? canAccess("num_tel") : numTelEnabled;
  const canAccessCallbacks = hasPermissions
    ? canAccess("callbacks")
    : callbacksEnabled;
  const canAccessSales = hasPermissions ? canAccess("sales") : salesEnabled;
  const canAccessLaunch = hasPermissions ? canAccess("launch") : launchEnabled;
  const canAccessDontCall = hasPermissions
    ? canAccess("dont_call")
    : dontCallEnabled;
  const canAccessCampaign = hasPermissions
    ? canAccess("campaign")
    : campaignEnabled;
  const [ticketsEnabled, setTicketsEnabled] = React.useState(() => canAccessTickets());
  const [recoveriesEnabled, setRecoveriesEnabled] = React.useState(() => canAccessRecoveries());
  const [assistantIAEnabled, setAssistantIAEnabled] = React.useState(() => canAccessAssistantIA());
  const [hydroEnabled, setHydroEnabled] = React.useState(() => canAccessHydro());
  const [seguimientosEnabled, setSeguimientosEnabled] = React.useState(() => canAccessSeguimientos());
  const [budgetEnabled, setBudgetEnabled] = React.useState(() => canAccessBudget());
  const [agentesEnabled, setAgentesEnabled] = React.useState(() => canAccessAgentes());

  // Revisar metadata cuando cambie (ej. al cambiar de cliente)
  React.useEffect(() => {
    const update = () => {
      setTicketsEnabled(canAccessTickets());
      setRecoveriesEnabled(canAccessRecoveries());
      setAssistantIAEnabled(canAccessAssistantIA());
      setHydroEnabled(canAccessHydro());
      setSeguimientosEnabled(canAccessSeguimientos());
      setBudgetEnabled(canAccessBudget());
      setAgentesEnabled(canAccessAgentes());
    };
    update();
    window.addEventListener("metadataUpdated", update);
    return () => window.removeEventListener("metadataUpdated", update);
  }, []);

  // Debug: Log para verificar el estado
  // console.log('🔧 Sidebar - Estado de permisos:', {
  //   hasPermissions,
  //   canAccessAgenda,
  //   canAccessRecords,
  //   canAccessNumTel,
  //   canAccessCallbacks,
  //   canAccessSales,
  //   canAccessLaunch,
  //   canAccessDontCall,
  //   // Valores originales del contexto
  //   launchEnabled,
  //   agendaEnabled,
  //   salesEnabled,
  //   numTelEnabled,
  //   recordsEnabled,
  //   callbacksEnabled,
  //   dontCallEnabled
  // });

  // Cargar client_ids disponibles desde client_test
  useEffect(() => {
    const loadClientIds = () => {
      const clientTest = getClientTest();
      const currentId = getClientIdFromSession();

      // console.log("🔍 Sidebar - Cargando client_ids:", {
      //   clientTest,
      //   currentId,
      //   clientTestType: typeof clientTest,
      //   isArray: Array.isArray(clientTest),
      // });

      if (clientTest) {
        // client_test es JSONB, puede ser un array o un objeto
        let clientIds: string[] = [];

        if (Array.isArray(clientTest)) {
          clientIds = clientTest.filter(
            (v): v is string => typeof v === "string" && v.trim() !== "",
          );
          // console.log("📋 client_test es array:", clientIds);
        } else if (typeof clientTest === "object" && clientTest !== null) {
          // Si es un objeto, intentar extraer los valores
          clientIds = Object.values(clientTest).filter(
            (v): v is string => typeof v === "string" && v.trim() !== "",
          );
          // console.log(
          //   "📋 client_test es objeto, valores extraídos:",
          //   clientIds,
          // );
        } else if (typeof clientTest === "string") {
          // Si es un string, intentar parsearlo como JSON
          try {
            const parsed = JSON.parse(clientTest);
            if (Array.isArray(parsed)) {
              clientIds = parsed.filter(
                (v): v is string => typeof v === "string" && v.trim() !== "",
              );
            } else if (typeof parsed === "object" && parsed !== null) {
              clientIds = Object.values(parsed).filter(
                (v): v is string => typeof v === "string" && v.trim() !== "",
              );
            }
            // console.log("📋 client_test parseado desde string:", clientIds);
          } catch (e) {
            // console.warn("⚠️ No se pudo parsear client_test como JSON:", e);
          }
        }

        // Agregar el client_id actual si no está en la lista
        if (currentId && !clientIds.includes(currentId)) {
          clientIds.unshift(currentId);
          // console.log("📋 Agregado client_id actual a la lista:", currentId);
        }

        setAvailableClientIds(clientIds);
        setCurrentClientId(currentId);
        // console.log(
        //   "✅ Client IDs finales disponibles:",
        //   clientIds,
        //   "Actual:",
        //   currentId,
        //   "Mostrar selector:",
        //   clientIds.length > 1,
        // );
      } else {
        // Si no hay client_test, solo mostrar el client_id actual
        // console.log(
        //   "ℹ️ No hay client_test, usando solo client_id actual:",
        //   currentId,
        // );
        if (currentId) {
          setAvailableClientIds([currentId]);
          setCurrentClientId(currentId);
        } else {
          setAvailableClientIds([]);
          setCurrentClientId(null);
        }
      }
    };

    loadClientIds();

    // Escuchar cambios en sessionStorage (para cuando cambie desde otra pestaña)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "clientId" || e.key === "client_test") {
        loadClientIds();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // También escuchar el evento de cambio de client_id
    const handleClientIdChanged = () => {
      // Pequeño delay para asegurar que sessionStorage se haya actualizado
      setTimeout(() => {
        loadClientIds();
      }, 100);
    };

    window.addEventListener("clientIdChanged", handleClientIdChanged);

    // Verificar periódicamente si cambió el clientId (para cambios en la misma pestaña)
    const interval = setInterval(() => {
      const currentId = getClientIdFromSession();
      if (currentId !== currentClientId) {
        loadClientIds();
      }
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("clientIdChanged", handleClientIdChanged);
      clearInterval(interval);
    };
  }, [currentClientId]);

  // Manejar cambio de client_id
  const handleClientIdChange = async (newClientId: string) => {
    if (newClientId === currentClientId || isChangingClient) {
      return;
    }

    setIsChangingClient(true);
    // console.log("🔄 Cambiando client_id de", currentClientId, "a", newClientId);

    try {
      // Cambiar el client_id
      const { error } = await changeClientId(newClientId);

      if (error) {
        // console.error("❌ Error al cambiar client_id:", error);
        toast.error("Error al cambiar el client_id. Por favor, intenta nuevamente.");
        return;
      }

      // Actualizar el estado local
      setCurrentClientId(newClientId);

      // El CallsContext escuchará el evento clientIdChanged y recargará los datos automáticamente
      // No necesitamos recargar manualmente ni hacer refresh de la página
      // console.log(
      //   "✅ Client_id cambiado, el CallsContext recargará los datos automáticamente",
      // );
    } catch (err) {
      // console.error("❌ Error al refrescar datos:", err);
      toast.error("Error al refrescar los datos. La página se recargará.");
      window.location.reload();
    } finally {
      setIsChangingClient(false);
    }
  };

  // Verificar si debemos mostrar Batch Call basado en parámetros URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callType = params.get("call");
    setShowBatchCall(callType === "outbound");
  }, []);

  // Cambiar de página. onPageChange (=navigateDashboard en DashboardApp) actualiza
  // la URL a /dashboard/<page> conservando los query params; el render se deriva de ahí.
  const navigateWithParams = (page: string) => {
    onPageChange(page);
    setIsMobileMenuOpen(false);
  };

  // Truncar la API key para mostrarla de forma segura
  const getApiKeyDisplay = () => {
    if (apiKeyTest && apiKeyTest.length > 0) {
      return `${apiKeyTest.length} API key${apiKeyTest.length > 1 ? "s" : ""} configurada${apiKeyTest.length > 1 ? "s" : ""}`;
    } else if (apiKey) {
      return `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
    } else {
      return "No configurada";
    }
  };

  const truncatedApiKey = getApiKeyDisplay();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    const syncProfileName = () => {
      const userData = getUserData();
      const name =
        getFullName() ||
        userData?.fullName ||
        userData?.full_name ||
        "";
      if (name) setProfileName(name);
    };

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ fullName?: string }>).detail;
      if (detail?.fullName) {
        setProfileName(detail.fullName);
      } else {
        syncProfileName();
      }
    };

    syncProfileName();
    window.addEventListener("profileUpdated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdated);
    };
  }, [user?.email]);

  const handleSignOut = async () => {
    try {
      setIsAccountMenuOpen(false);
      await signOut();
    } catch (error) {
      // console.error("Error al cerrar sesión:", error);
    }
  };

  const resolvedProfileName =
    profileName ||
    getFullName() ||
    getUserData()?.fullName ||
    getUserData()?.full_name ||
    "";
  const userEmail = user?.email || getEmail() || "";
  const userDisplayName = resolvedProfileName || userEmail || "Usuario";
  const userInitial = (resolvedProfileName || userEmail || "U")[0].toUpperCase();
  const showEmailSubtitle =
    Boolean(userEmail) && userDisplayName.toLowerCase() !== userEmail.toLowerCase();

  return (
    <>
      {/* Botón de menú móvil (visible solo en pantallas pequeñas) */}
      <button
        onClick={toggleMobileMenu}
        className="fixed top-4 left-4 z-50 p-2 bg-[#05163b] border border-[#0a2a5a] rounded-md shadow-md md:hidden"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Overlay para cerrar el menú en móvil al tocar fuera */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
          onClick={toggleMobileMenu}
        ></div>
      )}

      <div
        className={`fixed top-0 left-0 h-full w-64 bg-[#05163b] border-r border-[#0a2a5a] p-4 z-40 transition-transform duration-300 ease-in-out transform flex flex-col ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-white">uMindsAI Dashboard</h1>
        </div>

        {/* Selector de Client ID con búsqueda - Solo se muestra si hay más de un client_id disponible */}
        {availableClientIds.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2 px-1">
              Client ID:
            </label>
            <div ref={clientDropdownRef} className="relative">
              {/* Input de búsqueda */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={isClientDropdownOpen ? clientSearch : (currentClientId || "")}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setIsClientDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setClientSearch("");
                    setIsClientDropdownOpen(true);
                  }}
                  placeholder="Buscar client ID..."
                  disabled={isChangingClient || loadingAllCalls || loadingDashboardData}
                  className="w-full bg-[#0a2a5a] border border-[#1e4a8a] text-white text-xs rounded-md pl-7 pr-7 py-2 focus:outline-none focus:border-blue-400 placeholder-gray-500 disabled:opacity-50 cursor-pointer"
                />
                <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none transition-transform ${isClientDropdownOpen ? "rotate-180" : ""}`} />
              </div>

              {/* Dropdown filtrado */}
              {isClientDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1f4a] border border-[#1e4a8a] rounded-md shadow-xl z-50 max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1e4a8a] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#2e5fa0]">
                  {availableClientIds
                    .filter((id) => id.toLowerCase().startsWith(clientSearch.toLowerCase()))
                    .map((clientId) => (
                      <button
                        key={clientId}
                        onClick={() => {
                          handleClientIdChange(clientId);
                          setIsClientDropdownOpen(false);
                          setClientSearch("");
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#1e4a8a] ${
                          clientId === currentClientId
                            ? "text-blue-300 font-semibold bg-[#1a3a6a]"
                            : "text-gray-200"
                        }`}
                      >
                        {clientId}
                      </button>
                    ))}
                  {availableClientIds.filter((id) =>
                    id.toLowerCase().startsWith(clientSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                      Sin resultados
                    </div>
                  )}
                </div>
              )}
            </div>

            {isChangingClient && (
              <div className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cambiando...
              </div>
            )}
          </div>
        )}

        {/* Indicador de API key en uso */}
        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-[#0a2a5a] rounded-md">
          <Key className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs text-gray-400 shrink-0">API Key</span>
          <span className="ml-auto text-xs text-white font-medium truncate">{truncatedApiKey}</span>
        </div>

        {/* Indicador de estado de caché */}
        {cacheStatus && (
          <div className="mt-2 text-xs text-gray-300 mb-4">
            {isLoading || loadingAllCalls ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#0a2a5a] rounded-md">
                  <svg className="animate-spin w-3 h-3 text-blue-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs text-blue-400">Cargando datos...</span>
                  {loadingProgress > 0 && totalCalls > 0 && (
                    <span className="text-xs text-white tabular-nums">{progressPercentage}%</span>
                  )}
                </div>
                {loadingProgress > 0 && (
                  <div className="w-full bg-[#0a2a5a] rounded-full h-1">
                    <div className="bg-blue-400 h-1 rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
                  </div>
                )}
              </div>
            ) : cacheStatus.startsWith("Caché activa") ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a2a5a] rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-medium">Caché activa</span>
                <span className="ml-auto text-white tabular-nums">
                  {cacheStatus.match(/\((.+)\)/)?.[1]}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a2a5a] rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                <span className="text-gray-500">Sin datos en caché</span>
              </div>
            )}
          </div>
        )}

        <nav className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1e4a8a] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#2e5fa0]">
          <button
            onClick={() => { navigateWithParams("dashboard"); }}
            className={`group flex w-full items-center gap-2 px-4 py-2 ${
              currentPage === "dashboard"
                ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                : "text-gray-300 hover:bg-[#0a2a5a]"
            } rounded-lg`}
          >
            <BarChart3 className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
            Dashboard
          </button>
          {agentesEnabled && (
            <button
              onClick={() => { navigateWithParams("agentes"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "agentes"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <BrainCircuit className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Agentes
            </button>
          )}
          {canAccessNumTel && (
            <button
              onClick={() => { navigateWithParams("phones"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "phones"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
              title="Números de Teléfono"
            >
              <Phone className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Números de Teléfono</span>
            </button>
          )}
          {canAccessCampaign && (
            <button
              onClick={() => { navigateWithParams("campaign"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "campaign"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <Megaphone className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Campaña
            </button>
          )}
          {recoveriesEnabled && (
            <button
              onClick={() => { navigateWithParams("recoveries"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "recoveries"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <RotateCcw className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Recobros
            </button>
          )}
          {hydroEnabled && (
            <button
              onClick={() => { navigateWithParams("interesados"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "interesados"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <Users className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Interesados
            </button>
          )}
          {canAccessAgenda && (
            <button
              onClick={() => { navigateWithParams("agendas"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "agendas"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <Calendar className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Agendas
            </button>
          )}
          {canAccessRecords && (
            <button
              onClick={() => { navigateWithParams("recordings"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "recordings"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <Mic className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Grabaciones
            </button>
          )}
          {canAccessCallbacks && (
            <button
              onClick={() => { navigateWithParams("callbacks"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "callbacks"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <PhoneCall className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Callbacks
            </button>
          )}
          {showBatchCall && (
            <button
              onClick={() => { navigateWithParams("batch-call"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "batch-call"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <PhoneOutgoing className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Llamadas en Lote
            </button>
          )}
          {canAccessSales && (
            <button
              onClick={() => { navigateWithParams("ventas"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "ventas"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <TrendingUp className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Ventas
            </button>
          )}
          {canAccessLaunch && (
            <button
              onClick={() => { navigateWithParams("lanzamiento"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "lanzamiento"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <Rocket className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Lanzamiento
            </button>
          )}
          {canAccessDontCall && (
            <button
              onClick={() => { navigateWithParams("no-llamar"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "no-llamar"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <PhoneOff className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              No Llamar
            </button>
          )}
          {ticketsEnabled && (
            <button
              onClick={() => { navigateWithParams("tickets"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "tickets"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <ClipboardList className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Tickets
            </button>
          )}
          {seguimientosEnabled && (
            <button
              onClick={() => navigateWithParams("seguimientos")}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "seguimientos"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <PhoneForwarded className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Seguimientos
            </button>
          )}
          {assistantIAEnabled && (
            <button
              onClick={() => { navigateWithParams("soporte-ia"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "soporte-ia"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <BotMessageSquare className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Soporte IA
            </button>
          )}
          {budgetEnabled && (
            <button
              onClick={() => { navigateWithParams("presupuesto"); }}
              className={`group flex w-full items-center gap-2 px-4 py-2 ${
                currentPage === "presupuesto"
                  ? "text-white bg-[#0a2a5a] border border-[#1e4a8a]"
                  : "text-gray-300 hover:bg-[#0a2a5a]"
              } rounded-lg`}
            >
              <Wallet className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              Presupuesto
            </button>
          )}
        </nav>

        {/* Información del usuario */}
        <div ref={accountMenuRef} className="relative mt-auto pt-4 border-t border-[#0a2a5a]">
          {isAccountMenuOpen && (
            <div className="absolute left-full bottom-0 ml-5 w-56 rounded-lg border border-[#0a2a5a] bg-[#05163b] shadow-xl overflow-hidden z-50">
              <div className="px-3 py-3 flex items-center gap-3 border-b border-[#0a2a5a]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1e4a8a] flex items-center justify-center text-white text-sm font-semibold">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">
                    {userDisplayName}
                  </div>
                  {showEmailSubtitle && (
                    <div className="text-xs text-gray-400 truncate">{userEmail}</div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigateWithParams("configuracion");
                  setIsAccountMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-[#0a2a5a] transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0 text-gray-400" />
                Configuración
              </button>

              <button
                type="button"
                onClick={() => {
                  navigateWithParams("planes");
                  setIsAccountMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-[#0a2a5a] transition-colors"
              >
                <CreditCard className="w-4 h-4 shrink-0 text-gray-400" />
                Planes y facturación
              </button>

              <div className="border-t border-[#0a2a5a]" />

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-[#0a2a5a] transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0 text-gray-400" />
                Cerrar sesión
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAccountMenuOpen((open) => !open)}
            className={`w-full px-3 py-2 rounded-md flex items-center gap-3 transition-colors ${
              isAccountMenuOpen
                ? "bg-[#1e4a8a]/60"
                : "bg-[#0a2a5a] hover:bg-[#1e4a8a]/40"
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1e4a8a] flex items-center justify-center text-white text-sm font-semibold">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm text-white font-medium truncate">
                {userDisplayName}
              </div>
              {showEmailSubtitle && (
                <div className="text-xs text-gray-400 truncate">{userEmail}</div>
              )}
            </div>
            <MoreVertical className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </div>
      </div>
    </>
  );
}
