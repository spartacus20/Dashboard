import React, { useState, useEffect, useMemo } from "react";
import {
  fetchAgendas,
  fetchAllAgendas,
  fetchAgendasByScheduledDate,
  deleteAgenda,
  getAverageCallsPerAgenda,
  updateAgendaStatus,
  MOTIVO_RECHAZO_FILTRO_SIN,
  MOTIVOS_RECHAZO_AGENDA_FILTRO,
} from "../api";
import { fetchLastAuditsMap } from "../services/api/agendas";
import { isAuditor as checkIsAuditor, getCurrentUserInfo } from "../lib/supabase";
import { Agenda } from "../types";
import { useCallsContext } from "../context/CallsContext";
import { useDashboardRoute, navigateDashboard } from "../lib/dashboardRoute";
import { AGENDAS_PAGE_SIZE } from "../lib/constants";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Building,
  Search,
  Filter,
  ListFilter,
  RefreshCw,
  AlertCircle,
  X,
  List,
  CalendarDays,
  Download,
  Trash2,
  BarChart3,
  CheckCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Rows3,
  MessageCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Chart } from "../components/ui/chart";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { AgendaModal } from "../components/AgendaModal";
import { AgendaCalendar } from "../components/AgendaCalendar";
import { AgendaLimitsManager } from "../components/AgendaLimitsManager";
import { exportAgendasToCSV, generateCSVFilename } from "../lib/csvExport";

interface AgendasProps {
  onNavigate: (page: string) => void;
}

export function Agendas({ onNavigate }: AgendasProps) {
  const { clientId } = useCallsContext();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [filteredAgendas, setFilteredAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAgentId, setFilterAgentId] = useState("all");
  const [filterApproved, setFilterApproved] = useState<
    "all" | "true" | "false"
  >("all");
  const [filterReviewed, setFilterReviewed] = useState<
    "all" | "true" | "false"
  >("all");
  const [filterMotivoRechazo, setFilterMotivoRechazo] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<"all" | "llamada" | "whatsapp">("all");
  const [scheduledDateFilter, setScheduledDateFilter] = useState<string[]>([]);
  const [onlyDuplicatedPhones, setOnlyDuplicatedPhones] = useState(false);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [datePreset, setDatePreset] = useState<
    "all" | "today" | "week" | "month" | "custom"
  >("today");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<
    "list" | "calendar" | "calendarScheduled" | "limits"
  >("list");
  const [selectedAgenda, setSelectedAgenda] = useState<Agenda | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Deep-linking: la agenda abierta vive en la URL (/dashboard/agendas/<id>)
  const { detailId } = useDashboardRoute();
  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<Agenda | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [averageStats, setAverageStats] = useState<{
    average_calls: number;
    total_agendas: number;
    total_agendas_in_range: number;
    total_calls: number;
  } | null>(null);
  const [loadingAverage, setLoadingAverage] = useState(false);
  // Animación de entrada de las cards Aprobadas/Revisadas cuando termina de cargar
  const [cardsContentVisible, setCardsContentVisible] = useState(false);
  // Permiso para ver estadísticas de Paneles Solares / Baterías según metadata.filtro_solar
  const [hasFiltroSolar, setHasFiltroSolar] = useState(false);
  // Cliente FIT: agendas vienen por llamada (con call_id) o por WhatsApp (sin call_id)
  const [hasFit, setHasFit] = useState(false);
  // Auditor: permiso y datos del usuario actual
  const [isAuditorUser, setIsAuditorUser] = useState(false);
  const [auditorInfo, setAuditorInfo] = useState<{ email: string; name: string }>({ email: '', name: '' });
  // Mapa agenda_id → último auditor { name, at }
  const [auditMap, setAuditMap] = useState<Record<number, { name: string; at: string }>>({});
  const itemsPerPage = AGENDAS_PAGE_SIZE;
  const [listViewMode, setListViewMode] = useState<"list" | "grouped">("list");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showUnifiedFiltersDropdown, setShowUnifiedFiltersDropdown] =
    useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = useState<
    Set<string>
  >(new Set());

  const getDateOnly = (value?: string | null) => {
    if (!value) return "";
    if (value.includes("T")) return value.split("T")[0];
    if (value.includes(" ")) return value.split(" ")[0];
    return value.slice(0, 10);
  };

  // Helpers para normalizar aprobada/revisada (API puede devolver boolean, string "true", o 1)
  const isApproved = (v: unknown): boolean =>
    v === true || v === "true" || v === 1 || (typeof v === "string" && v.toLowerCase() === "true");
  const isReviewed = (v: unknown): boolean =>
    v === true || v === "true" || v === 1 || (typeof v === "string" && v.toLowerCase() === "true");
  const isValidInitialAddress = (addr: string | null | undefined): boolean => {
    if (!addr) return false;
    const alphanumeric = (addr.match(/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g) || []).length;
    return alphanumeric >= 5;
  };

  // Mostrar contenido de cards con fade-in cuando termina la carga; ocultar al cargar de nuevo
  useEffect(() => {
    if (loading) {
      setCardsContentVisible(false);
    } else {
      const t = setTimeout(() => setCardsContentVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Cargar agendas
  const loadAgendas = async () => {
    if (!clientId) {
      setError("Client ID no disponible");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // console.log('Cargando agendas para client_id:', clientId);
      // console.log('Filtros de fecha aplicados:', { dateFrom, dateTo });

      // Usar fetchAllAgendas para obtener todas las agendas con filtros de fecha y tipo
      const agendasData = await fetchAllAgendas(
        clientId,
        undefined, // searchTerm (la búsqueda se aplica en el cliente)
        filterType !== "all" ? filterType : undefined, // filtro por tipo de agenda
        dateFrom || undefined,
        dateTo || undefined,
        sortOrder, // sort_order
        filterAgentId !== "all" ? filterAgentId : undefined, // agentId
        filterMotivoRechazo !== "all" ? filterMotivoRechazo : undefined,
      );

      // Asegurar que siempre trabajamos con un array
      const validAgendas = Array.isArray(agendasData) ? agendasData : [];
      // console.log('Agendas válidas recibidas:', validAgendas);

      setAgendas(validAgendas);
      setFilteredAgendas(validAgendas);

      // Cargar mapa de auditorías para cualquier usuario con filtro_solar
      if (clientId) {
        const meta = sessionStorage.getItem("metadata");
        const hasSolar = meta ? JSON.parse(meta)?.filtro_solar === true : false;
        if (hasSolar) {
          fetchLastAuditsMap(clientId).then(setAuditMap).catch(() => {});
        }
      }
    } catch (err) {
      // console.error("Error al cargar agendas:", err);
      setError(err instanceof Error ? err.message : "Error al cargar agendas");
      // En caso de error, asegurar que tenemos arrays vacíos
      setAgendas([]);
      setFilteredAgendas([]);
    } finally {
      setLoading(false);
    }
  };

  // Verificar permiso filtro_solar desde sessionStorage y escuchar cambios de metadata
  useEffect(() => {
    const updateFromSession = () => {
      try {
        const metadataStr = sessionStorage.getItem("metadata");
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          setHasFiltroSolar(metadata?.filtro_solar === true);
          setHasFit(metadata?.fit === true);
        } else {
          setHasFiltroSolar(false);
          setHasFit(false);
        }
      } catch (error) {
        setHasFiltroSolar(false);
        setHasFit(false);
      }
      // Auditor: leer desde permissions (independiente de metadata)
      const auditor = checkIsAuditor();
      setIsAuditorUser(auditor);
      if (auditor) {
        setAuditorInfo(getCurrentUserInfo());
      }
    };

    const handleMetadataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.metadata) {
        setHasFiltroSolar(customEvent.detail.metadata.filtro_solar === true);
        setHasFit(customEvent.detail.metadata.fit === true);
      } else {
        updateFromSession();
      }
    };

    // Leer al montar
    updateFromSession();

    // Escuchar actualizaciones globales de metadata (por ejemplo, al cambiar de client_id)
    window.addEventListener("metadataUpdated", handleMetadataUpdate);

    return () => {
      window.removeEventListener("metadataUpdated", handleMetadataUpdate);
    };
  }, []);

  // Si se pierde el permiso de cliente solar, salir de la pestaña de límites
  useEffect(() => {
    if (!hasFiltroSolar && activeTab === "limits") {
      setActiveTab("list");
    }
  }, [hasFiltroSolar, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".unified-filters-dropdown-agendas") &&
        !target.closest(".unified-filters-button-agendas")
      ) {
        setShowUnifiedFiltersDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar agendas al montar el componente o cuando cambien los filtros de fecha, tipo, ordenamiento o agente
  useEffect(() => {
    loadAgendas();
  }, [clientId, dateFrom, dateTo, sortOrder, filterAgentId, filterType, filterMotivoRechazo]);

  // Cargar promedio de llamadas por agenda
  useEffect(() => {
    const loadAverageCalls = async () => {
      if (!clientId) return;

      setLoadingAverage(true);
      try {
        const stats = await getAverageCallsPerAgenda(
          clientId,
          dateFrom || undefined,
          dateTo || undefined,
        );
        setAverageStats({
          average_calls: stats.average_calls,
          total_agendas: stats.total_agendas,
          total_agendas_in_range:
            stats.total_agendas_in_range ?? stats.total_agendas,
          total_calls: stats.total_calls,
        });
      } catch (err) {
        // console.error("Error al cargar promedio de llamadas:", err);
        setAverageStats(null);
      } finally {
        setLoadingAverage(false);
      }
    };

    loadAverageCalls();
  }, [clientId, dateFrom, dateTo]);

  // Filtrar agendas (búsqueda, tipo y estados; fechas y agente se filtran en la API)
  useEffect(() => {
    // Asegurar que agendas sea un array antes de filtrarlo
    const validAgendas = Array.isArray(agendas) ? agendas : [];
    let filtered = [...validAgendas];

    // Calcular teléfonos duplicados para el filtro específico
    const phoneCounts = validAgendas.reduce<Record<string, number>>(
      (acc, agenda) => {
        const phone = agenda.phone_number;
        if (!phone) return acc;
        acc[phone] = (acc[phone] || 0) + 1;
        return acc;
      },
      {},
    );
    const duplicatedPhones = new Set(
      Object.entries(phoneCounts)
        .filter(([, count]) => count > 1)
        .map(([phone]) => phone),
    );

    // Filtrar por búsqueda (teléfono: coincidencia 100% exacta, sin similares)
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const termDigits = term.replace(/[^0-9]/g, "");
      const isPhoneSearch = termDigits.length >= 6;
      filtered = filtered.filter((agenda) => {
        const phone = String(agenda.phone_number || "");
        const phoneDigits = phone.replace(/[^0-9]/g, "");
        const nombre = (agenda.nombre || "").toLowerCase();
        const direccion = (agenda.direccion || "").toLowerCase();
        const ciudad = (agenda.ciudad || "").toLowerCase();
        const region = (agenda.region || "").toLowerCase();

        if (isPhoneSearch) {
          if (phoneDigits === termDigits) return true;
          if (termDigits.length === 9 && phoneDigits === "34" + termDigits) return true;
          if (phoneDigits.length === 9 && termDigits === "34" + phoneDigits) return true;
          return false;
        }
        const matchesPhone = termDigits.length > 0
          ? phoneDigits === termDigits
          : phone.toLowerCase().includes(term);
        return (
          matchesPhone ||
          nombre.includes(term) ||
          direccion.includes(term) ||
          ciudad.includes(term) ||
          region.includes(term)
        );
      });
    }

    // Filtrar por tipo de agenda (además del filtro en la API, reforzamos en el cliente)
    if (filterType !== "all") {
      filtered = filtered.filter((agenda) => agenda.tipo_agenda === filterType);
    }

    // Filtrar por estado "aprobada"
    if (filterApproved !== "all") {
      filtered = filtered.filter((agenda) => {
        const val = isApproved(agenda.aprobada);
        if (filterApproved === "true") return val;
        if (filterApproved === "false") return !val;
        return true;
      });
    }

    // Filtrar por estado "revisada"
    if (filterReviewed !== "all") {
      filtered = filtered.filter((agenda) => {
        const val = isReviewed(agenda.revisada);
        if (filterReviewed === "true") return val;
        if (filterReviewed === "false") return !val;
        return true;
      });
    }

    // Motivo de rechazo (refuerzo en cliente; el filtro principal viene de la API)
    if (filterMotivoRechazo !== "all") {
      if (filterMotivoRechazo === MOTIVO_RECHAZO_FILTRO_SIN) {
        filtered = filtered.filter(
          (a) =>
            a.motivo_rechazo == null ||
            String(a.motivo_rechazo).trim() === "",
        );
      } else {
        filtered = filtered.filter(
          (a) => a.motivo_rechazo === filterMotivoRechazo,
        );
      }
    }

    // Filtro opcional: solo teléfonos con más de una agenda (para detectar duplicados)
    if (onlyDuplicatedPhones) {
      filtered = filtered.filter(
        (agenda) =>
          agenda.phone_number && duplicatedPhones.has(agenda.phone_number),
      );
    }

    // Filtrar por canal de origen (solo clientes FIT)
    if (filterChannel !== "all") {
      if (filterChannel === "llamada") {
        filtered = filtered.filter((agenda) => !!agenda.call_id);
      } else if (filterChannel === "whatsapp") {
        filtered = filtered.filter((agenda) => !agenda.call_id);
      }
    }

    // Filtrar por días agendados (fecha de visita) — puede ser uno o varios
    if (scheduledDateFilter.length > 0) {
      filtered = filtered.filter((agenda) =>
        scheduledDateFilter.includes(getDateOnly(agenda.fecha_agendamiento)),
      );
    }

    // NOTA: Los filtros de fecha (dateFrom, dateTo) y agente se aplican en la API
    // No se filtran aquí para evitar duplicación

    setFilteredAgendas(filtered);
    setCurrentPage(1); // Reset a primera página cuando cambian los filtros
  }, [
    agendas,
    searchTerm,
    filterType,
    filterApproved,
    filterReviewed,
    filterMotivoRechazo,
    filterChannel,
    onlyDuplicatedPhones,
    scheduledDateFilter,
  ]);

  // Estadísticas de agendas duplicadas por teléfono (2 iguales = 1 repetida, 3 iguales = 2 repetidas...)
  const duplicateStats = useMemo(() => {
    const validAgendas = Array.isArray(agendas) ? agendas : [];
    const phoneCounts = validAgendas.reduce<Record<string, number>>(
      (acc, agenda) => {
        const phone = agenda.phone_number;
        if (!phone) return acc;
        acc[phone] = (acc[phone] || 0) + 1;
        return acc;
      },
      {},
    );
    let totalRepetidas = 0;
    let numerosConDuplicados = 0;
    for (const count of Object.values(phoneCounts)) {
      if (count > 1) {
        totalRepetidas += count - 1; // 2 iguales → 1 repetida, 3 iguales → 2 repetidas
        numerosConDuplicados += 1;
      }
    }
    return { totalRepetidas, numerosConDuplicados };
  }, [agendas]);

  // Agrupar agendas filtradas por día de agendamiento
  const groupedByDay = useMemo(() => {
    const map = new Map<string, { agendas: typeof filteredAgendas; dateLabel: string }>();
    for (const agenda of filteredAgendas) {
      const dateKey = getDateOnly(agenda.fecha_agendamiento) || "sin-fecha";
      if (!map.has(dateKey)) {
        let label = "Sin fecha";
        if (dateKey !== "sin-fecha") {
          try {
            const d = new Date(`${dateKey}T00:00:00`);
            label = d.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            });
            label = label.charAt(0).toUpperCase() + label.slice(1);
          } catch {
            label = dateKey;
          }
        }
        map.set(dateKey, { agendas: [], dateLabel: label });
      }
      map.get(dateKey)!.agendas.push(agenda);
    }
    // Ordenar días: sin-fecha al final, resto por fecha ASC
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === "sin-fecha") return 1;
        if (b === "sin-fecha") return -1;
        return a.localeCompare(b);
      })
      .map(([dateKey, value]) => ({ dateKey, ...value }));
  }, [filteredAgendas]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  // Obtener tipos únicos para el filtro
  const uniqueTypes = [
    ...new Set(
      (Array.isArray(agendas) ? agendas : []).map(
        (agenda) => agenda.tipo_agenda,
      ),
    ),
  ].filter(Boolean);

  // Obtener agentes únicos para el filtro
  const uniqueAgents = [
    ...new Set(
      (Array.isArray(agendas) ? agendas : [])
        .map((agenda) => agenda.agent_id)
        .filter(Boolean),
    ),
  ].sort();

  const activeUnifiedFiltersCount = useMemo(() => {
    let n = 0;
    if (searchTerm.trim()) n++;
    if (filterType !== "all") n++;
    if (filterAgentId !== "all") n++;
    if (filterApproved !== "all") n++;
    if (filterReviewed !== "all") n++;
    if (filterMotivoRechazo !== "all") n++;
    if (filterChannel !== "all") n++;
    if (sortOrder !== "DESC") n++;
    return n;
  }, [
    searchTerm,
    filterType,
    filterAgentId,
    filterApproved,
    filterReviewed,
    filterMotivoRechazo,
    filterChannel,
    sortOrder,
  ]);

  const toggleAgendaFilterSection = (key: string) => {
    setExpandedFilterSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Paginación
  const totalPages = Math.ceil(filteredAgendas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentAgendas = filteredAgendas.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Formatear fecha
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // Aplicar presets de fecha (hoy, semana, mes, todas, personalizado)
  const applyDatePreset = (
    preset: "all" | "today" | "week" | "month" | "custom",
  ) => {
    setDatePreset(preset);

    const today = new Date();

    const format = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    if (preset === "today") {
      const start = new Date(today);
      const end = new Date(today);
      setDateFrom(format(start));
      setDateTo(format(end));
      return;
    }

    if (preset === "week") {
      const start = new Date(today);
      const day = start.getDay() || 7; // 1-7, donde 1 = lunes si queremos ajustar
      // Llevar al lunes de esta semana
      start.setDate(start.getDate() - (day - 1));
      setDateFrom(format(start));
      setDateTo(format(today));
      return;
    }

    if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(format(start));
      setDateTo(format(today));
      return;
    }

    // 'custom' no toca las fechas, solo marca el estado
  };

  // Limpiar filtros de fecha
  const clearDateFilters = () => {
    setDateFrom("");
    setDateTo("");
    setDatePreset("all");
  };

  const clearListFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterAgentId("all");
    setFilterApproved("all");
    setFilterReviewed("all");
    setFilterMotivoRechazo("all");
    setFilterChannel("all");
    setSortOrder("DESC");
  };

  // Abrir/cerrar el modal navegando: la URL es la fuente de verdad y el efecto
  // de abajo sincroniza el estado del modal con el id de la URL.
  const openAgendaModal = (agenda: Agenda) => {
    navigateDashboard("agendas", String(agenda.id));
  };

  const closeAgendaModal = () => {
    navigateDashboard("agendas");
  };

  // Sincronizar el modal con la URL (deep-link, atrás/adelante, recarga)
  useEffect(() => {
    if (detailId) {
      if (!selectedAgenda || String(selectedAgenda.id) !== detailId) {
        const agenda = agendas.find((a) => String(a.id) === detailId);
        if (agenda) {
          setSelectedAgenda(agenda);
          setModalOpen(true);
        }
      }
    } else if (modalOpen) {
      setModalOpen(false);
      setSelectedAgenda(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, agendas]);

  // Abrir modal de confirmación de eliminación
  const openDeleteModal = (agenda: Agenda, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevenir que se abra el modal de detalles
    setAgendaToDelete(agenda);
    setDeleteModalOpen(true);
  };

  // Cerrar modal de eliminación
  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setAgendaToDelete(null);
  };

  // Eliminar agenda
  const handleDeleteAgenda = async () => {
    if (!agendaToDelete || !clientId) {
      setError("No se puede eliminar la agenda: datos incompletos");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteAgenda(agendaToDelete.id, clientId);

      // Eliminar de la lista local
      setAgendas((prevAgendas) =>
        prevAgendas.filter((a) => a.id !== agendaToDelete.id),
      );
      setFilteredAgendas((prevFiltered) =>
        prevFiltered.filter((a) => a.id !== agendaToDelete.id),
      );

      // Cerrar modal
      closeDeleteModal();

      toast.success("Agenda eliminada exitosamente");
    } catch (err) {
      // console.error("Error al eliminar agenda:", err);
      setError(
        err instanceof Error ? err.message : "Error al eliminar la agenda",
      );
    } finally {
      setDeleting(false);
    }
  };

  // Actualizar estado (aprobada / revisada) desde el modal y refrescar lista
  const handleStatusUpdated = () => {
    // Recargar agendas para reflejar cambios hechos en el modal
    loadAgendas();
  };

  // Exportar agendas a CSV
  const handleExportCSV = async () => {
    if (!clientId) {
      setError("Client ID no disponible");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      // console.log("Iniciando exportación CSV...");

      // Mostrar mensaje informativo
      const message =
        "Obteniendo todas las agendas (esto puede tomar unos momentos)...";
      // console.log(message);

      // Obtener todas las agendas con los filtros actuales
      const allAgendas = await fetchAllAgendas(
        clientId,
        searchTerm || undefined,
        filterType !== "all" ? filterType : undefined,
        dateFrom || undefined,
        dateTo || undefined,
        sortOrder,
        filterAgentId !== "all" ? filterAgentId : undefined,
        filterMotivoRechazo !== "all" ? filterMotivoRechazo : undefined,
      );

      if (allAgendas.length === 0) {
        setError("No hay agendas para exportar");
        return;
      }

      // Generar nombre de archivo descriptivo
      const filename = generateCSVFilename(
        allAgendas.length,
        searchTerm,
        filterType,
        dateFrom,
        dateTo,
      );

      // Exportar a CSV
      exportAgendasToCSV(allAgendas, filename);

      // console.log(
      //   `Exportación completada: ${allAgendas.length} agendas exportadas`,
      // );

      // Mostrar mensaje de éxito
      toast.success(
        `Exportación completada: ${allAgendas.length} agendas exportadas a ${filename}`,
      );
    } catch (err) {
      // console.error("Error al exportar agendas:", err);
      setError(
        err instanceof Error ? err.message : "Error al exportar agendas",
      );
    } finally {
      setExporting(false);
    }
  };

  // Calcular estadísticas de agendas (usando todas las agendas, no las filtradas)
  // Las agendas sin tipo_agenda se consideran paneles solares por defecto
  const panelesSolaresCount = agendas.filter(
    (agenda) =>
      !agenda.tipo_agenda || // Sin categoría = paneles solares por defecto
      agenda.tipo_agenda?.toLowerCase().includes("paneles solares") ||
      agenda.tipo_agenda?.toLowerCase().includes("placas solares"),
  ).length;

  const bateriasCount = agendas.filter(
    (agenda) =>
      // Solo contar baterías si tiene tipo_agenda específico de baterías
      agenda.tipo_agenda &&
      (agenda.tipo_agenda.toLowerCase().includes("baterías") ||
        agenda.tipo_agenda.toLowerCase().includes("baterias") ||
        agenda.tipo_agenda.toLowerCase().includes("bateria") ||
        agenda.tipo_agenda.toLowerCase().includes("batería")),
  ).length;

  // Aprobadas por tipo (usa isApproved para normalizar formato API)
  const aprobadasPanelesCount = agendas.filter(
    (agenda) =>
      isApproved(agenda.aprobada) &&
      (!agenda.tipo_agenda ||
        agenda.tipo_agenda?.toLowerCase().includes("paneles solares") ||
        agenda.tipo_agenda?.toLowerCase().includes("placas solares")),
  ).length;

  const aprobadasBateriasCount = agendas.filter(
    (agenda) =>
      isApproved(agenda.aprobada) &&
      agenda.tipo_agenda &&
      (agenda.tipo_agenda.toLowerCase().includes("baterías") ||
        agenda.tipo_agenda.toLowerCase().includes("baterias") ||
        agenda.tipo_agenda.toLowerCase().includes("bateria") ||
        agenda.tipo_agenda.toLowerCase().includes("batería")),
  ).length;

  const aprobadasPanelesRatio = panelesSolaresCount
    ? aprobadasPanelesCount / panelesSolaresCount
    : 0;
  const aprobadasBateriasRatio = bateriasCount
    ? aprobadasBateriasCount / bateriasCount
    : 0;

  // Obtener clases de color para la etiqueta de tipo de agenda en la lista
  const getAgendaTypeBadgeClass = (tipo?: string | null) => {
    const t = (tipo || "").toLowerCase();

    // Solo placas/paneles solares en amarillo-naranja; el resto como estaba (azul)
    if (t.includes("paneles solares") || t.includes("placas solares")) {
      return "bg-gradient-to-r from-yellow-500 to-orange-600";
    }

    return "bg-gradient-to-r from-blue-600 to-indigo-700";
  };

  return (
    <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
              Agendas
            </h1>
            <p className="text-slate-600">
              Gestiona tus agendas y visualiza el calendario
            </p>
          </div>
          {activeTab === "list" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={exporting || loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors text-white text-sm font-medium"
              >
                <Download
                  className={`w-4 h-4 ${exporting ? "animate-pulse" : ""}`}
                />
                {exporting ? "Exportando..." : "Exportar CSV"}
              </button>
              <button
                onClick={loadAgendas}
                disabled={loading}
                className="flex items-center gap-2 bg-[#0a2a5a] border border-[#1e4a8a] hover:bg-[#1e4a8a] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors text-white text-sm font-medium"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Actualizar
              </button>
            </div>
          )}
        </div>

        {/* Cards de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card de Paneles Solares (solo si filtro_solar = true en metadata) */}
          {hasFiltroSolar && (
            <div className="bg-white rounded-lg p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">
                      Paneles Solares
                    </h3>
                    <p className="text-sm text-slate-600">
                      Agendas de instalación
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600">
                    {panelesSolaresCount}
                  </div>
                  <div className="text-xs text-slate-500">
                    {panelesSolaresCount === 1 ? "agenda" : "agendas"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card de Baterías (solo si filtro_solar = true en metadata) */}
          {hasFiltroSolar && (
            <div className="bg-white rounded-lg p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">
                      Baterías
                    </h3>
                    <p className="text-sm text-slate-600">
                      Agendas de instalación
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">
                    {bateriasCount}
                  </div>
                  <div className="text-xs text-slate-500">
                    {bateriasCount === 1 ? "agenda" : "agendas"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card de Total: mismo número que Promedio de llamadas por agenda (total_agendas_in_range) */}
          <div className="bg-white rounded-lg p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Total
                  </h3>
                  <p className="text-sm text-slate-600">Todas las agendas</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">
                  {averageStats != null
                    ? (averageStats.total_agendas_in_range ??
                      averageStats.total_agendas)
                    : agendas.length}
                </div>
                <div className="text-xs text-slate-500">
                  {(averageStats != null
                    ? (averageStats.total_agendas_in_range ??
                      averageStats.total_agendas)
                    : agendas.length) === 1
                    ? "agenda"
                    : "agendas"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards Aprobadas/Revisadas solo para clientes solares */}
        {hasFiltroSolar && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 w-full">
            <Card className="shadow-lg border-slate-200 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">
                    Aprobadas Paneles Solares
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-[100px]">
                {loading ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-14 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600">Total aprobadas</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700">
                        {aprobadasPanelesCount.toLocaleString("es-ES")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {aprobadasPanelesCount === 1 ? "agenda" : "agendas"}
                      </div>
                      <div className="text-xs font-semibold text-blue-600 mt-1">
                        {panelesSolaresCount
                          ? `${Math.round(aprobadasPanelesRatio * 100)}% del total`
                          : "0% del total"}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-slate-200 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Aprobadas Baterías</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-[100px]">
                {loading ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-14 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600">Total aprobadas</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700">
                        {aprobadasBateriasCount.toLocaleString("es-ES")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {aprobadasBateriasCount === 1 ? "agenda" : "agendas"}
                      </div>
                      <div className="text-xs font-semibold text-blue-600 mt-1">
                        {bateriasCount
                          ? `${Math.round(aprobadasBateriasRatio * 100)}% del total`
                          : "0% del total"}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Revisadas (global) */}
            <Card className="shadow-lg border-slate-200 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center">
                    <Eye className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Revisadas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-[100px]">
                {loading ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-14 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600">Total revisadas</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700">
                        {agendas
                          .filter((a) => isReviewed(a.revisada))
                          .length.toLocaleString("es-ES")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {agendas.filter((a) => isReviewed(a.revisada)).length === 1
                          ? "agenda"
                          : "agendas"}
                      </div>
                      <div className="text-xs font-semibold text-blue-600 mt-1">
                        {agendas.length
                          ? `${Math.round((agendas.filter((a) => isReviewed(a.revisada)).length / agendas.length) * 100)}% del total`
                          : "0% del total"}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pestañas */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "list"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <List className="w-5 h-5" />
            Lista de Agendas
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "calendar"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            Calendario
          </button>
          <button
            onClick={() => setActiveTab("calendarScheduled")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "calendarScheduled"
                ? "text-emerald-700 border-b-2 border-emerald-700"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            Calendario de Agendas
          </button>
          {hasFiltroSolar && (
            <button
              onClick={() => setActiveTab("limits")}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeTab === "limits"
                  ? "text-blue-700 border-b-2 border-blue-700"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Filter className="w-5 h-5" />
              Límites (Paneles y Baterías)
            </button>
          )}
        </div>

        {/* Contenido de las pestañas */}
        {activeTab === "list" && (
          <div>
            {/* Card: Promedio de llamadas por agenda con gráfico y rango rápido */}
            <Card className="mb-6 shadow-lg border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">
                    Promedio de llamadas por agenda
                  </CardTitle>
                </div>
                <CardDescription>
                  {averageStats
                    ? `${(averageStats.total_agendas_in_range ?? averageStats.total_agendas).toLocaleString("es-ES")} agendas · ${averageStats.total_calls.toLocaleString("es-ES")} llamadas totales`
                    : "Selecciona un rango para ver el promedio"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-slate-500 text-sm font-medium">
                    Rango:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyDatePreset("today")}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === "today"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => applyDatePreset("week")}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === "week"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Esta semana
                    </button>
                    <button
                      onClick={() => applyDatePreset("month")}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === "month"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Este mes
                    </button>
                    <button
                      onClick={() => applyDatePreset("all")}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === "all"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Todas las agendas
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setDatePreset("custom");
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Fecha desde"
                    />
                    <span className="text-slate-400 text-sm">–</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setDatePreset("custom");
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Fecha hasta"
                    />
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={clearDateFilters}
                        className="flex items-center gap-1 px-2 py-1.5 text-slate-600 hover:text-slate-800 text-sm rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {loadingAverage && (
                  <div className="py-6 text-center text-slate-500 text-sm">
                    Calculando promedio de llamadas...
                  </div>
                )}
                {!loadingAverage && averageStats !== null && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="text-center md:text-left">
                      <p className="text-3xl font-bold text-blue-600">
                        {averageStats.average_calls.toFixed(2)}
                      </p>
                      <p className="text-sm text-slate-600">
                        llamadas por agenda (promedio)
                      </p>
                    </div>
                    <div className="md:col-span-2 h-[180px]">
                      <Chart
                        data={[
                          {
                            label: "Llamadas por agenda (promedio)",
                            llamadas: averageStats.average_calls,
                          },
                        ]}
                        type="bar"
                        xKey="label"
                        yKey="llamadas"
                        height={180}
                        colors={["#7c3aed"]}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Filtro rápido para detectar agendas duplicadas por teléfono */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Detección de agendas duplicadas
                </p>
                <p className="text-xs text-slate-500">
                  Muestra solo las agendas que comparten el mismo número de teléfono.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              {onlyDuplicatedPhones && (
                <span className={`text-lg font-semibold shrink-0 ${duplicateStats.totalRepetidas > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                  {duplicateStats.totalRepetidas} agenda{duplicateStats.totalRepetidas !== 1 ? 's' : ''} repetida{duplicateStats.totalRepetidas !== 1 ? 's' : ''}
                </span>
              )}
              <div className="flex items-center gap-2">
                <input
                id="only-duplicated-phones"
                type="checkbox"
                checked={onlyDuplicatedPhones}
                onChange={(e) => setOnlyDuplicatedPhones(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="only-duplicated-phones"
                className="text-sm text-slate-700 cursor-pointer select-none"
              >
                Ver solo teléfonos con agendas duplicadas
              </label>
              </div>
            </div>
          </div>

            {/* Toggle de modo de vista */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {filteredAgendas.length} agenda{filteredAgendas.length !== 1 ? "s" : ""} encontrada{filteredAgendas.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setListViewMode("list")}
                  title="Vista en lista"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    listViewMode === "list"
                      ? "bg-white shadow text-blue-600"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                  Lista
                </button>
                <button
                  onClick={() => setListViewMode("grouped")}
                  title="Agrupar por día agendado"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    listViewMode === "grouped"
                      ? "bg-white shadow text-blue-600"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Rows3 className="w-4 h-4" />
                  Por día
                </button>
              </div>
            </div>

            {/* Filtros de lista + día agendado en la misma caja. Rango por creación en card Promedio. */}
            <div className="mb-6 space-y-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                <div className="flex flex-col-reverse sm:flex-row-reverse sm:flex-wrap sm:items-center gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 sm:justify-end pt-3 border-t border-slate-100 sm:border-t-0 sm:pt-0 sm:border-l sm:border-slate-200 sm:pl-4">
                  <span className="text-xs font-medium text-slate-600 shrink-0 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Día agendado
                  </span>
                  <div className="relative flex-1 min-w-[140px] max-w-[200px]">
                    <input
                      type="date"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !scheduledDateFilter.includes(val)) {
                          setScheduledDateFilter([
                            ...scheduledDateFilter,
                            val,
                          ]);
                        }
                        e.target.value = "";
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      title="Añadir fecha de día agendado al filtro"
                    />
                  </div>
                  {scheduledDateFilter.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setScheduledDateFilter([])}
                      className="text-xs text-slate-500 hover:text-slate-800 underline shrink-0"
                    >
                      Quitar todos los días
                    </button>
                  )}
                </div>

                <div className="relative unified-filters-dropdown-agendas w-full sm:w-auto sm:shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setShowUnifiedFiltersDropdown(!showUnifiedFiltersDropdown)
                  }
                  className="w-full sm:w-auto min-w-[220px] h-10 flex items-center justify-center gap-2 text-xs unified-filters-button-agendas border-slate-300"
                >
                  <ListFilter className="w-4 h-4 shrink-0" />
                  <span>Filtros</span>
                  {activeUnifiedFiltersCount > 0 && (
                    <Badge
                      variant="default"
                      className="ml-1 px-1.5 py-0 text-[10px] shrink-0"
                    >
                      {activeUnifiedFiltersCount}
                    </Badge>
                  )}
                  {showUnifiedFiltersDropdown ? (
                    <ChevronUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  )}
                </Button>

                {showUnifiedFiltersDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-[min(100vw-2rem,22rem)] sm:w-80 bg-white rounded-xl shadow-xl z-50 border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Filtros
                      </span>
                      {activeUnifiedFiltersCount > 0 && (
                        <span className="text-xs text-blue-600 font-medium whitespace-nowrap">
                          {activeUnifiedFiltersCount} activo
                          {activeUnifiedFiltersCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                      {/* Búsqueda */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleAgendaFilterSection("busqueda")}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              Búsqueda
                            </span>
                            {searchTerm.trim() ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : null}
                          </div>
                          <span className="text-slate-400 text-base leading-none shrink-0">
                            {expandedFilterSections.has("busqueda")
                              ? "−"
                              : "+"}
                          </span>
                        </button>
                        {expandedFilterSections.has("busqueda") && (
                          <div className="px-4 pb-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                              <input
                                type="text"
                                placeholder="Teléfono, dirección..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tipo de agenda — oculto para clientes FIT */}
                      {!hasFit && (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleAgendaFilterSection("tipo")}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-slate-700">
                                Tipo de agenda
                              </span>
                              {filterType !== "all" ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              ) : null}
                            </div>
                            <span className="text-slate-400 text-base leading-none shrink-0">
                              {expandedFilterSections.has("tipo") ? "−" : "+"}
                            </span>
                          </button>
                          {expandedFilterSections.has("tipo") && (
                            <div className="px-4 pb-3">
                              <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                                <select
                                  value={filterType}
                                  onChange={(e) =>
                                    setFilterType(e.target.value)
                                  }
                                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                  <option value="all">Todos los tipos</option>
                                  {uniqueTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Agente */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleAgendaFilterSection("agente")}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              Agente
                            </span>
                            {filterAgentId !== "all" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : null}
                          </div>
                          <span className="text-slate-400 text-base leading-none shrink-0">
                            {expandedFilterSections.has("agente") ? "−" : "+"}
                          </span>
                        </button>
                        {expandedFilterSections.has("agente") && (
                          <div className="px-4 pb-3">
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                              <select
                                value={filterAgentId}
                                onChange={(e) =>
                                  setFilterAgentId(e.target.value)
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                              >
                                <option value="all">Todos los agentes</option>
                                {uniqueAgents.map((agentId) => (
                                  <option key={agentId} value={agentId}>
                                    {agentId}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Aprobada */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            toggleAgendaFilterSection("aprobada")
                          }
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              Aprobada
                            </span>
                            {filterApproved !== "all" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : null}
                          </div>
                          <span className="text-slate-400 text-base leading-none shrink-0">
                            {expandedFilterSections.has("aprobada")
                              ? "−"
                              : "+"}
                          </span>
                        </button>
                        {expandedFilterSections.has("aprobada") && (
                          <div className="px-4 pb-3">
                            <div className="relative">
                              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                              <select
                                value={filterApproved}
                                onChange={(e) =>
                                  setFilterApproved(
                                    e.target.value as "all" | "true" | "false",
                                  )
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                              >
                                <option value="all">Todas</option>
                                <option value="true">Solo aprobadas</option>
                                <option value="false">Solo no aprobadas</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Revisada */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            toggleAgendaFilterSection("revisada")
                          }
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              Revisada
                            </span>
                            {filterReviewed !== "all" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : null}
                          </div>
                          <span className="text-slate-400 text-base leading-none shrink-0">
                            {expandedFilterSections.has("revisada")
                              ? "−"
                              : "+"}
                          </span>
                        </button>
                        {expandedFilterSections.has("revisada") && (
                          <div className="px-4 pb-3">
                            <div className="relative">
                              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                              <select
                                value={filterReviewed}
                                onChange={(e) =>
                                  setFilterReviewed(
                                    e.target.value as "all" | "true" | "false",
                                  )
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                              >
                                <option value="all">Todas</option>
                                <option value="true">Solo revisadas</option>
                                <option value="false">Solo no revisadas</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Motivo de rechazo */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            toggleAgendaFilterSection("motivo_rechazo")
                          }
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              Motivo de rechazo
                            </span>
                            {filterMotivoRechazo !== "all" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : null}
                          </div>
                          <span className="text-slate-400 text-base leading-none shrink-0">
                            {expandedFilterSections.has("motivo_rechazo")
                              ? "−"
                              : "+"}
                          </span>
                        </button>
                        {expandedFilterSections.has("motivo_rechazo") && (
                          <div className="px-4 pb-3">
                            <div className="relative">
                              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                              <select
                                value={filterMotivoRechazo}
                                onChange={(e) =>
                                  setFilterMotivoRechazo(e.target.value)
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                              >
                                <option value="all">Todos</option>
                                <option value={MOTIVO_RECHAZO_FILTRO_SIN}>
                                  Sin motivo
                                </option>
                                {MOTIVOS_RECHAZO_AGENDA_FILTRO.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Canal de origen — solo clientes FIT */}
                      {hasFit && (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleAgendaFilterSection("canal")}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-slate-700">
                                Canal de origen
                              </span>
                              {filterChannel !== "all" ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              ) : null}
                            </div>
                            <span className="text-slate-400 text-base leading-none shrink-0">
                              {expandedFilterSections.has("canal") ? "−" : "+"}
                            </span>
                          </button>
                          {expandedFilterSections.has("canal") && (
                            <div className="px-4 pb-3">
                              <div className="flex flex-col gap-1.5">
                                {(["all", "llamada", "whatsapp"] as const).map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setFilterChannel(opt)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                                      filterChannel === opt
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    }`}
                                  >
                                    {opt === "llamada" && <Phone className="w-3.5 h-3.5 shrink-0" />}
                                    {opt === "whatsapp" && <MessageCircle className="w-3.5 h-3.5 shrink-0" />}
                                    {opt === "all" && <Filter className="w-3.5 h-3.5 shrink-0" />}
                                    {opt === "all" ? "Todos los canales" : opt === "llamada" ? "Llamada" : "WhatsApp"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Orden */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleAgendaFilterSection("orden")}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              Orden
                            </span>
                            {sortOrder !== "DESC" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : null}
                          </div>
                          <span className="text-slate-400 text-base leading-none shrink-0">
                            {expandedFilterSections.has("orden") ? "−" : "+"}
                          </span>
                        </button>
                        {expandedFilterSections.has("orden") && (
                          <div className="px-4 pb-3">
                            <div className="relative">
                              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                              <select
                                value={sortOrder}
                                onChange={(e) =>
                                  setSortOrder(
                                    e.target.value as "ASC" | "DESC",
                                  )
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                              >
                                <option value="DESC">
                                  Más recientes primero
                                </option>
                                <option value="ASC">
                                  Más antiguos primero
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {activeUnifiedFiltersCount > 0 && (
                      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => clearListFilters()}
                          className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 transition-colors"
                        >
                          Restablecer filtros de lista
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
              </div>

              {scheduledDateFilter.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs text-slate-500 mr-1">
                    Días agendados:
                  </span>
                  {scheduledDateFilter.map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() =>
                          setScheduledDateFilter(
                            scheduledDateFilter.filter((x) => x !== d),
                          )
                        }
                        className="hover:text-blue-600"
                        title={`Quitar ${d}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setScheduledDateFilter([])}
                    className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mr-3" />
                <span className="text-slate-600">Cargando agendas...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}

            {/* Vista agrupada por día */}
            {!loading && !error && listViewMode === "grouped" && (
              <div className="space-y-3">
                {groupedByDay.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-600 mb-2">No se encontraron agendas</h3>
                    <p className="text-slate-500">Intenta ajustar los filtros de búsqueda.</p>
                  </div>
                ) : (
                  groupedByDay.map(({ dateKey, dateLabel, agendas: dayAgendas }) => {
                    const isExpanded = expandedDays.has(dateKey);
                    const aprobadas = dayAgendas.filter((a) => isApproved(a.aprobada)).length;
                    const noAprobadas = dayAgendas.length - aprobadas;
                    const revisadas = dayAgendas.filter((a) => isReviewed(a.revisada)).length;
                    // Horas únicas agendadas, ordenadas
                    const horas = [...new Set(
                      dayAgendas
                        .map((a) => {
                          if (!a.fecha_agendamiento) return null;
                          try {
                            const d = new Date(a.fecha_agendamiento);
                            return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                          } catch { return null; }
                        })
                        .filter(Boolean)
                    )].sort() as string[];

                    return (
                      <div key={dateKey} className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
                        {/* Header del día — clickable */}
                        <button
                          onClick={() => toggleDay(dateKey)}
                          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left gap-4"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Icono de calendario con número de día */}
                            <div className="shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex flex-col items-center justify-center text-white shadow-sm">
                              {dateKey !== "sin-fecha" ? (
                                <>
                                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                    {new Date(`${dateKey}T00:00:00`).toLocaleDateString("es-ES", { month: "short" })}
                                  </span>
                                  <span className="text-lg font-bold tabular-nums">
                                    {new Date(`${dateKey}T00:00:00`).getDate()}
                                  </span>
                                </>
                              ) : (
                                <Calendar className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              {/* Fecha con jerarquía tipográfica */}
                              {(() => {
                                const comma = dateLabel.indexOf(",");
                                const weekday = comma >= 0 ? dateLabel.slice(0, comma) : dateLabel;
                                const rest = comma >= 0 ? dateLabel.slice(comma + 2) : "";
                                return (
                                  <div>
                                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-0.5">
                                      {weekday}
                                    </span>
                                    <span className="block text-base font-bold text-slate-800 leading-snug truncate">
                                      {rest || dateLabel}
                                    </span>
                                  </div>
                                );
                              })()}
                              {/* Chips de horas */}
                              {horas.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {horas.map((h) => (
                                    <span key={h} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" />
                                      {h}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Stats del día */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-1.5 rounded-full shadow-sm shadow-blue-200">
                              <span className="text-sm font-bold tabular-nums">{dayAgendas.length}</span>
                              <span className="text-xs font-medium opacity-90">{dayAgendas.length === 1 ? "agenda" : "agendas"}</span>
                            </div>
                            <div className="hidden md:flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle className="w-3 h-3" />
                                {aprobadas} aprobada{aprobadas !== 1 ? "s" : ""}
                              </span>
                              {noAprobadas > 0 && (
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-200">
                                  {noAprobadas} no aprobada{noAprobadas !== 1 ? "s" : ""}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200">
                                <Eye className="w-3 h-3" />
                                {revisadas} revisada{revisadas !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </button>

                        {/* Agendas del día expandidas */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50 px-4 pb-4 pt-3 space-y-3">
                            {dayAgendas
                              .slice()
                              .sort((a, b) => {
                                const ta = a.fecha_agendamiento ?? "";
                                const tb = b.fecha_agendamiento ?? "";
                                return ta.localeCompare(tb);
                              })
                              .map((agenda) => (
                                <div
                                  key={agenda.id}
                                  onClick={() => openAgendaModal(agenda)}
                                  className="relative bg-white border border-slate-200 shadow rounded-xl overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-[1px] cursor-pointer"
                                >
                                  <div className="p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="shrink-0 p-2 bg-blue-50 rounded-lg text-blue-600">
                                          <User className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 truncate">{agenda.nombre || "Sin nombre"}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="text-xs text-slate-500 font-medium">{agenda.phone_number || "—"}</span>
                                            {agenda.fecha_agendamiento && (
                                              <>
                                                <span className="text-slate-300">·</span>
                                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="text-xs font-semibold text-blue-600">
                                                  {(() => {
                                                    try {
                                                      const d = new Date(agenda.fecha_agendamiento);
                                                      return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                                                    } catch { return "—"; }
                                                  })()}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {agenda.tipo_agenda && !hasFit && (
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wide ${getAgendaTypeBadgeClass(agenda.tipo_agenda)}`}>
                                            {agenda.tipo_agenda}
                                          </span>
                                        )}
                                        <button
                                          onClick={(e) => openDeleteModal(agenda, e)}
                                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Eliminar agenda"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        {agenda.direccion || "Sin dirección"}
                                        {agenda.ciudad ? ` · ${agenda.ciudad}` : ""}
                                        {agenda.region ? `, ${agenda.region}` : ""}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Mini barra de estados */}
                                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex flex-wrap items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isApproved(agenda.aprobada) ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                                      {isApproved(agenda.aprobada) ? "Aprobada" : "No aprobada"}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isReviewed(agenda.revisada) ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                                      {isReviewed(agenda.revisada) ? "Revisada" : "No revisada"}
                                    </span>
                                    {isReviewed(agenda.revisada) && !isApproved(agenda.aprobada) && (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${agenda.llamada_enviada === true ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                                        {agenda.llamada_enviada === true ? "✓ Notif. enviada" : "⏳ Notif. pendiente"}
                                      </span>
                                    )}
                                    {hasFit && (
                                      <span
                                        className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${agenda.call_id ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-green-100 text-green-700 border-green-200"}`}
                                        title={agenda.call_id ? "Agendado por llamada" : "Agendado por WhatsApp"}
                                      >
                                        {agenda.call_id
                                          ? <Phone className="w-3 h-3" />
                                          : <MessageCircle className="w-3 h-3" />}
                                        {agenda.call_id ? "Llamada" : "WhatsApp"}
                                      </span>
                                    )}
                                    {hasFiltroSolar && auditMap[agenda.id] && (
                                      <div className="relative group ml-auto">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 bg-blue-100 text-blue-700 border-blue-200 cursor-default">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                          {auditMap[agenda.id].name}
                                        </span>
                                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 pointer-events-none">
                                          <div className="bg-slate-800 text-white rounded-xl px-3 py-2.5 shadow-2xl whitespace-nowrap min-w-[160px]">
                                            <p className="flex items-center gap-1.5 text-blue-400 font-bold text-[9px] uppercase tracking-wider mb-1.5">
                                              <Clock className="w-3 h-3" />
                                              Última auditoría
                                            </p>
                                            <p className="text-white font-semibold text-xs">
                                              {new Date(auditMap[agenda.id].at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                                            </p>
                                            <p className="text-slate-400 text-[11px] mt-0.5">
                                              {new Date(auditMap[agenda.id].at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                            <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-800" />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Agendas list */}
            {!loading && !error && listViewMode === "list" && (
              <div>
                {currentAgendas.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-600 mb-2">
                      {agendas.length === 0
                        ? "No hay agendas"
                        : "No se encontraron agendas"}
                    </h3>
                    <p className="text-slate-500">
                      {agendas.length === 0
                        ? "Aún no tienes agendas registradas."
                        : "Intenta ajustar los filtros de búsqueda."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentAgendas.map((agenda) => (
                      <div
                        key={agenda.id}
                        onClick={() => openAgendaModal(agenda)}
                        className="relative bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-[16px] overflow-hidden transition-all duration-200 hover:shadow-2xl hover:-translate-y-[1px] cursor-pointer"
                      >
                        <div className="p-6">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                            <div className="flex items-start gap-4">
                              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                                <User className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-slate-800 leading-tight">
                                  {agenda?.nombre || "Sin nombre"}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-medium">
                                      {agenda?.phone_number || "Sin teléfono"}
                                    </span>
                                  </div>
                                  {agenda?.agent_id && (
                                    <>
                                      <span className="h-4 w-px bg-slate-200" />
                                      <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-medium text-blue-600">
                                          {agenda.agent_id}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Botón eliminar alineado a la derecha */}
                            <div className="flex items-start gap-2">
                              <button
                                onClick={(e) => openDeleteModal(agenda, e)}
                                className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors bg-slate-50 rounded-lg"
                                title="Eliminar agenda"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
                            {/* Fechas y tipo de agenda */}
                            <div className="space-y-4">
                              <div className="space-y-3 text-slate-600">
                                <div className="flex items-center gap-3">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <div className="text-sm">
                                    <span className="text-slate-400">
                                      Agendado:
                                    </span>
                                    <span className="font-semibold ml-1">
                                      {agenda?.fecha_agendamiento
                                        ? formatDate(agenda.fecha_agendamiento)
                                        : "Sin fecha"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-slate-400" />
                                  <div className="text-sm">
                                    <span className="text-slate-400">
                                      Creado:
                                    </span>
                                    <span className="font-medium ml-1">
                                      {agenda?.created_at
                                        ? formatDate(agenda.created_at)
                                        : "Sin fecha"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {agenda?.tipo_agenda && !hasFit && (
                                <span
                                  className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black text-white shadow-sm uppercase tracking-[0.1em] ${getAgendaTypeBadgeClass(agenda.tipo_agenda)}`}
                                >
                                  {agenda.tipo_agenda}
                                </span>
                              )}
                            </div>

                            {/* Información de ubicación */}
                            <div className="flex gap-3 text-slate-600 md:border-l md:border-slate-100 md:pl-6">
                              <MapPin className="w-5 h-5 mt-1 text-slate-400" />
                              <div className="text-sm">
                                <p className="font-semibold text-slate-700">
                                  {agenda?.direccion || "Sin dirección"}
                                </p>
                                <p className="text-slate-500">
                                  {agenda?.ciudad || "Sin ciudad"}
                                  {agenda?.region && `, ${agenda.region}`}
                                </p>
                                {agenda?.codigo_postal && (
                                  <p className="text-slate-400 font-mono text-xs mt-1">
                                    {agenda.codigo_postal}
                                  </p>
                                )}
                                {isValidInitialAddress(agenda?.initial_address) && (
                                  <p className="text-slate-400 text-xs mt-1.5 border-t border-slate-100 pt-1.5">
                                    <span className="uppercase tracking-wide font-semibold text-slate-400">Dirección inicial:</span>{" "}
                                    {agenda.initial_address}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Call ID / información extra */}
                            <div className="md:border-l md:border-slate-100 md:pl-6">
                              {agenda?.call_id && (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                                      Internal Call ID
                                    </p>
                                  </div>
                                  <code className="font-mono text-[11px] text-slate-500 break-all leading-relaxed">
                                    {agenda.call_id}
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Barra inferior con estados Aprobada / Revisada */}
                        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex flex-wrap items-center gap-3">
                          {/* Aprobada (solo display) */}
                          <div
                            className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default ${
                              isApproved(agenda.aprobada)
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-red-100 text-red-800 border-red-300"
                            }`}
                            title="Estado de aprobación"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isApproved(agenda.aprobada)
                                  ? "bg-emerald-500"
                                  : "bg-red-500"
                              }`}
                            />
                            <span>
                              {isApproved(agenda.aprobada)
                                ? "Aprobada"
                                : "No aprobada"}
                            </span>
                          </div>

                          {/* Revisada (solo display) */}
                          <div
                            className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default ${
                              isReviewed(agenda.revisada)
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-red-100 text-red-800 border-red-300"
                            }`}
                            title="Estado de revisión"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isReviewed(agenda.revisada)
                                  ? "bg-emerald-500"
                                  : "bg-red-500"
                              }`}
                            />
                            <span>
                              {isReviewed(agenda.revisada)
                                ? "Revisada"
                                : "No revisada"}
                            </span>
                          </div>

                          {/* Notificación webhook — solo visible si rechazada */}
                          {isReviewed(agenda.revisada) && !isApproved(agenda.aprobada) && (
                            <div
                              className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default ${
                                agenda.llamada_enviada === true
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                              title={agenda.llamada_enviada === true ? "Notificación enviada al sistema externo" : "Notificación pendiente de envío"}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  agenda.llamada_enviada === true ? "bg-blue-500" : "bg-amber-500"
                                }`}
                              />
                              <span>
                                {agenda.llamada_enviada === true ? "Notif. enviada" : "Notif. pendiente"}
                              </span>
                            </div>
                          )}

                          {/* Canal de origen — solo para clientes FIT */}
                          {hasFit && (
                            <div
                              className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default ml-auto ${
                                agenda.call_id
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : "bg-green-100 text-green-800 border-green-300"
                              }`}
                              title={agenda.call_id ? "Agendado por llamada" : "Agendado por WhatsApp"}
                            >
                              {agenda.call_id
                                ? <Phone className="w-3 h-3" />
                                : <MessageCircle className="w-3 h-3" />}
                              <span>{agenda.call_id ? "Llamada" : "WhatsApp"}</span>
                            </div>
                          )}

                          {/* Badge de auditoría — solo si fue auditada */}
                          {hasFiltroSolar && auditMap[agenda.id] && (
                            <div className="relative group ml-auto">
                              <div className="px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default bg-blue-100 text-blue-800 border-blue-300">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <span>Auditada por {auditMap[agenda.id].name}</span>
                              </div>
                              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 pointer-events-none">
                                <div className="bg-slate-800 text-white rounded-xl px-3 py-2.5 shadow-2xl whitespace-nowrap min-w-[170px]">
                                  <p className="flex items-center gap-1.5 text-blue-400 font-bold text-[9px] uppercase tracking-wider mb-1.5">
                                    <Clock className="w-3 h-3" />
                                    Última auditoría
                                  </p>
                                  <p className="text-white font-semibold text-xs">
                                    {new Date(auditMap[agenda.id].at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                                  </p>
                                  <p className="text-slate-400 text-[11px] mt-0.5">
                                    {new Date(auditMap[agenda.id].at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                  <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-800" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8">
                    <div className="text-sm text-slate-600">
                      Mostrando {startIndex + 1} a{" "}
                      {Math.min(
                        startIndex + itemsPerPage,
                        filteredAgendas.length,
                      )}{" "}
                      de {filteredAgendas.length} agendas
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-slate-200 text-slate-600 rounded disabled:opacity-50 hover:bg-slate-300 transition-colors"
                      >
                        Anterior
                      </button>

                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-1 rounded transition-colors ${
                                currentPage === pageNum
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white"
                                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}

                      <button
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-slate-200 text-slate-600 rounded disabled:opacity-50 hover:bg-slate-300 transition-colors"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pestaña del Calendario (creación) */}
        {activeTab === "calendar" && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
                Calendario
              </h3>
              <p className="text-slate-600 text-sm">
                Agendas ubicadas según la fecha en que fueron creadas.
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mr-3" />
                <span className="text-slate-600">Cargando calendario...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            ) : (
              <AgendaCalendar
                agendas={filteredAgendas}
                onAgendaClick={openAgendaModal}
                onLoadMonthAgendas={
                  clientId
                    ? (year, month) => {
                        const mm = String(month + 1).padStart(2, '0');
                        const lastDay = new Date(year, month + 1, 0).getDate();
                        return fetchAllAgendas(
                          clientId,
                          undefined,
                          undefined,
                          `${year}-${mm}-01`,
                          `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
                          undefined,
                          undefined,
                          filterMotivoRechazo !== "all"
                            ? filterMotivoRechazo
                            : undefined,
                        );
                      }
                    : undefined
                }
                mode="created"
                hasFit={hasFit}
              />
            )}
          </div>
        )}

        {activeTab === "calendarScheduled" && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-teal-800 mb-2">
                Calendario de Agendas
              </h3>
              <p className="text-slate-600 text-sm">
                Visualiza tus agendas posicionadas en la fecha en que fueron
                agendadas (fecha de visita).
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin w-8 h-8 text-emerald-600 mr-3" />
                <span className="text-slate-600">Cargando calendario...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            ) : (
              <AgendaCalendar
                agendas={filteredAgendas}
                onAgendaClick={openAgendaModal}
                onLoadMonthAgendas={
                  clientId
                    ? (year, month) =>
                        fetchAgendasByScheduledDate(
                          clientId,
                          year,
                          month,
                          filterMotivoRechazo !== "all"
                            ? filterMotivoRechazo
                            : undefined,
                        )
                    : undefined
                }
                mode="scheduled"
                hasFit={hasFit}
              />
            )}
          </div>
        )}

        {hasFiltroSolar && activeTab === "limits" && <AgendaLimitsManager />}

        {/* Modal de agenda */}
        <AgendaModal
          agenda={selectedAgenda}
          isOpen={modalOpen}
          onClose={closeAgendaModal}
          onStatusChange={handleStatusUpdated}
          isAuditor={isAuditorUser}
          auditorEmail={auditorInfo.email}
          auditorName={auditorInfo.name}
          clientId={clientId ?? undefined}
        />

        {/* Modal de confirmación de eliminación */}
        {deleteModalOpen && agendaToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
              <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-red-50 to-orange-50">
                <div className="flex items-center">
                  <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
                  <h3 className="text-lg font-medium text-slate-800">
                    Confirmar eliminación
                  </h3>
                </div>
                <button
                  onClick={closeDeleteModal}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                  disabled={deleting}
                >
                  <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
                </button>
              </div>

              <div className="p-5 space-y-5 bg-white">
                <div>
                  <p className="text-slate-700 mb-3">
                    ¿Estás seguro de que quieres eliminar la agenda de{" "}
                    <span className="font-bold text-slate-800">
                      {agendaToDelete.nombre || "Sin nombre"}
                    </span>
                    ?
                  </p>
                  <p className="text-slate-600 text-sm">
                    Esta acción no se puede deshacer y eliminará permanentemente
                    esta agenda y todos sus datos asociados.
                  </p>
                </div>

                {agendaToDelete.phone_number && (
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-slate-600 text-sm">
                      <span className="font-medium">Teléfono:</span>{" "}
                      {agendaToDelete.phone_number}
                    </p>
                    {agendaToDelete.fecha_agendamiento && (
                      <p className="text-slate-600 text-sm mt-1">
                        <span className="font-medium">Fecha:</span>{" "}
                        {formatDate(agendaToDelete.fecha_agendamiento)}
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end pt-3 gap-2">
                  <button
                    onClick={closeDeleteModal}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 mr-2 transition-colors"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAgenda}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
