import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Filter,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { AgendaSlot } from '../types';
import { createAgendaSlot, deleteAgendaSlot, fetchAgendaSlots, fetchSlotProvinces, updateAgendaSlot } from '../api';

const toTimeInputValue = (value: string): string => {
  if (!value) return '';
  return value.length >= 5 ? value.slice(0, 5) : value;
};

const toDbTimeValue = (value: string): string => {
  if (!value) return value;
  return value.length === 5 ? `${value}:00` : value;
};

const normalizeTime = (value: string): string => {
  if (!value) return '';
  return toTimeInputValue(value);
};

const formatDate = (value: string): string => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (value: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getOccupancyStyle = (ocupadas: number, maxCitas: number): string => {
  if (!maxCitas) return 'bg-slate-100 text-slate-600';
  const ratio = ocupadas / maxCitas;
  if (ratio >= 0.8) return 'bg-red-100 text-red-700';
  if (ratio >= 0.5) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const getDotStyle = (ocupadas: number, maxCitas: number): string => {
  if (!maxCitas) return 'bg-slate-400';
  const ratio = ocupadas / maxCitas;
  if (ratio >= 0.8) return 'bg-red-400';
  if (ratio >= 0.5) return 'bg-amber-400';
  return 'bg-emerald-400';
};

export type AgendaLimitsTipo = 'placas_solares' | 'bateria';

export function AgendaLimitsManager() {
  const [slots, setSlots] = useState<AgendaSlot[]>([]);
  const [provincias, setProvincias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterProvincia, setFilterProvincia] = useState('all');
  const [filterFecha, setFilterFecha] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | AgendaLimitsTipo>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTipo, setCreateTipo] = useState<AgendaLimitsTipo>('placas_solares');
  const todayStr = new Date().toISOString().slice(0, 10);
  const [createFechaInput, setCreateFechaInput] = useState(todayStr);
  const [createFechas, setCreateFechas] = useState<string[]>([todayStr]);
  const [createHoraInput, setCreateHoraInput] = useState('00:00');
  const [createHoras, setCreateHoras] = useState<string[]>(['00:00']);
  const [createProvincia, setCreateProvincia] = useState('');
  const [createMaxCitas, setCreateMaxCitas] = useState('1');
  const [createOcupadas, setCreateOcupadas] = useState('0');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editFecha, setEditFecha] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editProvincia, setEditProvincia] = useState('');
  const [editMaxCitas, setEditMaxCitas] = useState('1');
  const [editOcupadas, setEditOcupadas] = useState('0');
  const [slotToDelete, setSlotToDelete] = useState<AgendaSlot | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tipoFilter = filterTipo === 'all' ? undefined : filterTipo;
      const [slotRows, provinciasRows] = await Promise.all([
        fetchAgendaSlots({
          provincia: filterProvincia !== 'all' ? filterProvincia : undefined,
          fecha: filterFecha || undefined,
          tipo: tipoFilter,
        }),
        fetchSlotProvinces(tipoFilter),
      ]);
      setSlots(slotRows);
      setProvincias(provinciasRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los límites de agendas');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [filterFecha, filterProvincia, filterTipo]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const onDelete = (slot: AgendaSlot) => {
    setSlotToDelete(slot);
    setError(null);
  };

  const confirmDelete = async () => {
    if (!slotToDelete) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteAgendaSlot(slotToDelete.id);
      setSlotToDelete(null);
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el límite');
    } finally {
      setDeleting(false);
    }
  };

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!createFechas?.length || !createHoras?.length || !createProvincia.trim()) {
      setError('Completá al menos 1 fecha, 1 hora y provincia');
      return;
    }

    const fechas = Array.from(new Set(createFechas)).sort();
    const horas = Array.from(new Set(createHoras.map(normalizeTime))).sort();
    for (const fecha of fechas) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        setError('Formato de fecha inválido. Usá YYYY-MM-DD');
        return;
      }
    }
    for (const hora of horas) {
      if (!/^\d{2}:\d{2}$/.test(hora)) {
        setError('Formato de hora inválido. Usá HH:MM');
        return;
      }
    }

    const maxCitas = Number(createMaxCitas);
    const ocupadas = Number(createOcupadas);
    if (!Number.isFinite(maxCitas) || maxCitas < 0) {
      setError('max_citas debe ser un número mayor o igual a 0');
      return;
    }
    if (!Number.isFinite(ocupadas) || ocupadas < 0) {
      setError('ocupadas debe ser un número mayor o igual a 0');
      return;
    }
    if (ocupadas > maxCitas) {
      setError('ocupadas no puede ser mayor que max_citas');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Guardar el mismo límite para cada combinación de fecha y hora seleccionada
      for (const fecha of fechas) {
        for (const hora of horas) {
          await createAgendaSlot({
            fecha,
            provincia: createProvincia.trim(),
            hora: toDbTimeValue(hora),
            max_citas: maxCitas,
            ocupadas,
            tipo: createTipo,
          });
        }
      }
      setCreateProvincia('');
      setCreateHoraInput('00:00');
      setCreateHoras(['00:00']);
      setCreateMaxCitas('1');
      setCreateOcupadas('0');
      setCreateFechaInput(todayStr);
      setCreateFechas([todayStr]);
      setShowCreateForm(false);
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el límite');
    } finally {
      setSaving(false);
    }
  };

  const addCreateFecha = () => {
    const fecha = createFechaInput;
    if (!fecha) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError('Formato de fecha inválido. Usá YYYY-MM-DD');
      return;
    }
    setError(null);
    setCreateFechas((prev) => {
      if (prev.includes(fecha)) return prev;
      return [...prev, fecha].sort();
    });
  };

  const removeCreateFecha = (fecha: string) => {
    setCreateFechas((prev) => prev.filter((f) => f !== fecha));
  };

  const addCreateHora = () => {
    const hora = normalizeTime(createHoraInput);
    if (!hora) return;
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      setError('Formato de hora inválido. Usá HH:MM');
      return;
    }
    setError(null);
    setCreateHoras((prev) => {
      if (prev.includes(hora)) return prev;
      return [...prev, hora].sort();
    });
  };

  const removeCreateHora = (hora: string) => {
    setCreateHoras((prev) => prev.filter((h) => h !== hora));
  };

  const startEdit = (slot: AgendaSlot) => {
    setEditingSlotId(slot.id);
    setEditFecha(slot.fecha);
    setEditHora(toTimeInputValue(slot.hora));
    setEditProvincia(slot.provincia);
    setEditMaxCitas(String(slot.max_citas));
    setEditOcupadas(String(slot.ocupadas));
    setError(null);
  };

  const cancelEdit = () => {
    setEditingSlotId(null);
    setEditFecha('');
    setEditHora('');
    setEditProvincia('');
    setEditMaxCitas('1');
    setEditOcupadas('0');
  };

  const onEdit = async (event: React.FormEvent, slotId: string) => {
    event.preventDefault();

    if (!editFecha || !editHora || !editProvincia.trim()) {
      setError('Completá fecha, hora y provincia');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(editFecha)) {
      setError('Formato de fecha inválido. Usá YYYY-MM-DD');
      return;
    }
    const maxCitas = Number(editMaxCitas);
    const ocupadas = Number(editOcupadas);
    if (!Number.isFinite(maxCitas) || maxCitas < 0) {
      setError('max_citas debe ser un número mayor o igual a 0');
      return;
    }
    if (!Number.isFinite(ocupadas) || ocupadas < 0) {
      setError('ocupadas debe ser un número mayor o igual a 0');
      return;
    }
    if (ocupadas > maxCitas) {
      setError('ocupadas no puede ser mayor que max_citas');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateAgendaSlot(slotId, {
        fecha: editFecha,
        provincia: editProvincia.trim(),
        hora: toDbTimeValue(editHora),
        max_citas: maxCitas,
        ocupadas,
      });
      cancelEdit();
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo editar el límite');
    } finally {
      setSaving(false);
    }
  };

  const rowsLabel = useMemo(() => {
    if (slots.length === 1) return '1 límite';
    return `${slots.length} límites`;
  }, [slots.length]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, { fecha: string; provincia: string; tipo: string; slots: AgendaSlot[]; maxTotal: number; ocupadasTotal: number }>();

    for (const slot of slots) {
      const slotTipo = slot.tipo || 'placas_solares';
      const key = `${slot.fecha}__${slot.provincia}__${slotTipo}`;
      const existing = groups.get(key);
      if (existing) {
        existing.slots.push(slot);
        existing.maxTotal += slot.max_citas;
        existing.ocupadasTotal += slot.ocupadas;
      } else {
        groups.set(key, {
          fecha: slot.fecha,
          provincia: slot.provincia,
          tipo: slotTipo,
          slots: [slot],
          maxTotal: slot.max_citas,
          ocupadasTotal: slot.ocupadas,
        });
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        slots: group.slots.sort((a, b) => a.hora.localeCompare(b.hora)),
      }))
      .sort((a, b) => {
        const byDate = a.fecha.localeCompare(b.fecha);
        if (byDate !== 0) return byDate;
        const byProv = a.provincia.localeCompare(b.provincia, 'es');
        if (byProv !== 0) return byProv;
        return (a.tipo || '').localeCompare(b.tipo || '');
      });
  }, [slots]);

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              Límites de citas
            </h1>
            <p className="text-slate-500 text-sm">
              Crea, edita y elimina límites de citas por provincia, fecha y hora (Paneles o Baterías).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-200 disabled:opacity-60"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreateForm ? 'Cancelar' : 'Crear límite'}
          </button>
        </header>

        {showCreateForm && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Tipo</label>
                    <select
                      value={createTipo}
                      onChange={(e) =>
                        setCreateTipo(e.target.value as AgendaLimitsTipo)
                      }
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    >
                      <option value="placas_solares">Paneles</option>
                      <option value="bateria">Baterías</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Fechas</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={createFechaInput}
                          onChange={(e) => setCreateFechaInput(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={addCreateFecha}
                          disabled={
                            !createFechaInput ||
                            createFechas.includes(createFechaInput) ||
                            saving
                          }
                          className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-60"
                          title="Agregar día"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-600">
                              Días seleccionados
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Se aplicará el mismo límite en cada día.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-700">
                              {createFechas.length}
                            </span>
                            {createFechas.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setCreateFechas([])}
                                disabled={saving}
                                className="text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 px-2 py-1 rounded-lg transition-colors"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                        </div>

                        {createFechas.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            Agregá al menos un día para guardar el límite.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {createFechas.map((fecha) => (
                              <div
                                key={fecha}
                                className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1"
                              >
                                <span className="text-[11px] font-mono text-slate-700 whitespace-nowrap">
                                  {formatDate(fecha)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeCreateFecha(fecha)}
                                  disabled={saving}
                                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                                  title="Quitar fecha"
                                >
                                  <X className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Provincia</label>
                    <input
                      type="text"
                      placeholder="Ej: Sevilla"
                      value={createProvincia}
                      onChange={(e) => setCreateProvincia(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Horas</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={createHoraInput}
                          onChange={(e) => setCreateHoraInput(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={addCreateHora}
                          disabled={
                            !createHoraInput ||
                            createHoras.includes(normalizeTime(createHoraInput)) ||
                            saving
                          }
                          className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-60"
                          title="Agregar hora"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-600">
                              Horas seleccionadas
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Se aplicará el mismo límite en cada hora.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-700">
                              {createHoras.length}
                            </span>
                            {createHoras.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setCreateHoras([])}
                                disabled={saving}
                                className="text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 px-2 py-1 rounded-lg transition-colors"
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                        </div>

                        {createHoras.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            Agregá al menos una hora para guardar el límite.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {createHoras.map((hora) => (
                              <div
                                key={hora}
                                className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1"
                              >
                                <span className="text-[11px] font-mono text-slate-700 whitespace-nowrap">
                                  {hora}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeCreateHora(hora)}
                                  disabled={saving}
                                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                                  title="Quitar hora"
                                >
                                  <X className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-28">
                    <label className="block text-sm text-slate-600 mb-1">Máx. citas</label>
                    <input
                      type="number"
                      min={0}
                      value={createMaxCitas}
                      onChange={(e) => setCreateMaxCitas(e.target.value)}
                      className="w-full px-2.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="w-28">
                    <label className="block text-sm text-slate-600 mb-1">Ocupadas</label>
                    <input
                      type="number"
                      min={0}
                      value={createOcupadas}
                      onChange={(e) => setCreateOcupadas(e.target.value)}
                      className="w-full px-2.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar límite'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as 'all' | AgendaLimitsTipo)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent appearance-none transition-all"
            >
              <option value="all">Todos (Paneles y Baterías)</option>
              <option value="placas_solares">Solo Paneles</option>
              <option value="bateria">Solo Baterías</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={filterProvincia}
              onChange={(e) => setFilterProvincia(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent appearance-none transition-all"
            >
              <option value="all">Todas las provincias</option>
              {provincias.map((provincia) => (
                <option key={provincia} value={provincia}>
                  {provincia}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="date"
              value={filterFecha}
              onChange={(e) => setFilterFecha(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterProvincia('all');
              setFilterFecha('');
              setFilterTipo('all');
            }}
            className="px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-slate-200 bg-white"
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={loadSlots}
            disabled={loading}
            className="px-4 py-3 bg-slate-900 text-white rounded-xl font-medium transition-all hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 flex items-center justify-center text-slate-500">
            <RefreshCw className="animate-spin w-5 h-5 mr-2" />
            Cargando límites...
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            No hay límites para los filtros seleccionados.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="px-1">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">
                {rowsLabel} en {groupedSlots.length} {groupedSlots.length === 1 ? 'grupo' : 'grupos'} (fecha + provincia)
              </h2>
            </div>

            {groupedSlots.map((group) => (
              <div
                key={`${group.fecha}-${group.provincia}-${group.tipo || 'placas_solares'}`}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5 border-b border-slate-100 flex flex-wrap items-center gap-4 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold">{formatDate(group.fecha)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{group.provincia}</span>
                  </div>
                  {filterTipo === 'all' && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      group.tipo === 'bateria' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {group.tipo === 'bateria' ? 'Baterías' : 'Paneles'}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getOccupancyStyle(group.ocupadasTotal, group.maxTotal)}`}>
                      {group.ocupadasTotal} / {group.maxTotal} ocupadas
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                      {group.slots.length} {group.slots.length === 1 ? 'horario' : 'horarios'}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-4 md:p-6 flex flex-col gap-4 hover:bg-slate-50 transition-colors"
                    >
                      {editingSlotId === slot.id ? (
                        <form onSubmit={(event) => onEdit(event, slot.id)} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Fecha</label>
                              <input
                                type="date"
                                value={editFecha}
                                onChange={(e) => setEditFecha(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Hora</label>
                              <input
                                type="time"
                                value={editHora}
                                onChange={(e) => setEditHora(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Provincia</label>
                              <input
                                type="text"
                                value={editProvincia}
                                onChange={(e) => setEditProvincia(e.target.value)}
                                placeholder="Provincia"
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Máx. citas</label>
                              <input
                                type="number"
                                min={0}
                                value={editMaxCitas}
                                onChange={(e) => setEditMaxCitas(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Ocupadas</label>
                              <input
                                type="number"
                                min={0}
                                value={editOcupadas}
                                onChange={(e) => setEditOcupadas(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex justify-end items-center gap-2">
                            <button
                              type="submit"
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                            >
                              <Save className="w-4 h-4" />
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all"
                            >
                              <X className="w-4 h-4" />
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-1">
                              <span className="text-lg font-bold">Hora: {toTimeInputValue(slot.hora)}</span>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${getDotStyle(slot.ocupadas, slot.max_citas)}`} />
                                <span className="text-sm font-medium">{slot.ocupadas} / {slot.max_citas} ocupadas</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400">Creado: {formatDateTime(slot.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(slot)}
                              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(slot)}
                              className="flex items-center gap-2 px-4 py-2 border border-red-100 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                              Borrar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {slotToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
            <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
                <h3 className="text-lg font-medium">Confirmar eliminación</h3>
              </div>
              <button
                onClick={() => setSlotToDelete(null)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                disabled={deleting}
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="text-sm space-y-2">
                <p>¿Seguro que querés eliminar este límite?</p>
                <p><span className="font-semibold">Fecha:</span> {formatDate(slotToDelete.fecha)}</p>
                <p><span className="font-semibold">Hora:</span> {toTimeInputValue(slotToDelete.hora)}</p>
                <p><span className="font-semibold">Provincia:</span> {slotToDelete.provincia}</p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSlotToDelete(null)}
                  className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
