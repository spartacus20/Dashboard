import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createTicket, deleteTicket, fetchTickets, updateTicket } from '../api';
import { Ticket } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { AlertCircle, ClipboardList, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';

interface TicketsProps {
  onNavigate: (page: string) => void;
}

export function Tickets({ onNavigate: _onNavigate }: TicketsProps) {
  const { clientId } = useCallsContext();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmTicket, setDeleteConfirmTicket] = useState<Ticket | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', responsible: '', state: '' });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', responsible: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canSubmit = useMemo(
    () => form.title.trim() && form.description.trim() && clientId,
    [form.title, form.description, clientId],
  );

  const loadTickets = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchTickets(clientId);
      setTickets(rows);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [clientId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('No se encontró client_id de sesión.');
      return;
    }
    if (!canSubmit) return;

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const responsibleToSend = form.responsible.trim() || 'Sin asignar';
      await createTicket({
        client_id: clientId,
        title: form.title.trim(),
        description: form.description.trim(),
        responsible: responsibleToSend,
      });
      setForm({ title: '', description: '', responsible: '' });
      setSuccess('Ticket creado correctamente con estado Pendiente.');
      await loadTickets();
      setShowCreateModal(false);
    } catch (e: any) {
      setError(e?.message || 'Error al crear ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteConfirm = (ticket: Ticket) => {
    setDeleteConfirmTicket(ticket);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmTicket(null);
  };

  const handleDeleteConfirmOk = async () => {
    const ticket = deleteConfirmTicket;
    if (!ticket || !clientId) return;
    setDeletingId(ticket.id);
    setError(null);
    setSuccess(null);
    setDeleteConfirmTicket(null);
    try {
      await deleteTicket(ticket.id, clientId);
      setSuccess('Ticket eliminado correctamente.');
      await loadTickets();
    } catch (e: any) {
      setError(e?.message || 'Error al eliminar ticket');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditOpen = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      responsible: ticket.responsible,
      state: ticket.state || 'Pendiente',
    });
  };

  const handleEditClose = () => {
    setEditingTicket(null);
    setEditForm({ title: '', description: '', responsible: '', state: '' });
  };

  const handleEditSave = async (e: FormEvent) => {
    e.preventDefault();
    const ticket = editingTicket;
    if (!ticket || !clientId) return;
    if (!editForm.title.trim() || !editForm.description.trim()) return;

    setSavingId(ticket.id);
    setError(null);
    setSuccess(null);
    try {
      await updateTicket({
        id: ticket.id,
        client_id: clientId,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        responsible: editForm.responsible.trim(),
        state: editForm.state || 'Pendiente',
      });
      setSuccess('Ticket actualizado correctamente.');
      handleEditClose();
      await loadTickets();
    } catch (e: any) {
      setError(e?.message || 'Error al actualizar ticket');
    } finally {
      setSavingId(null);
    }
  };

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f8fafc]">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex flex-1 justify-center py-8">
          <div className="flex flex-col w-full max-w-[1000px] px-4 md:px-10 gap-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-slate-800">Tickets</h1>
                <p className="text-slate-500 text-base">Crea tareas de mejora para tu dashboard</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={loadTickets}
                  disabled={loading}
                  className="flex min-w-[100px] items-center justify-center rounded-lg h-10 px-5 bg-blue-600 text-white text-sm font-bold transition-all hover:bg-blue-500 disabled:opacity-60 shrink-0"
                >
                  <span className="truncate inline-flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setShowCreateModal(true);
                  }}
                  className="flex min-w-[140px] items-center justify-center rounded-lg h-10 px-5 bg-teal-500 text-white text-sm font-bold transition-all hover:bg-teal-600 shrink-0 shadow-md shadow-teal-500/20"
                >
                  <span className="inline-flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Crear ticket
                  </span>
                </button>
              </div>
            </div>

            {(error || success) && (
              <div className="space-y-2">
                {error && (
                  <div className="mt-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mt-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
                    {success}
                  </div>
                )}
              </div>
            )}

            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 px-1">
                <ClipboardList className="w-5 h-5 text-[#7f19e6]" />
                Tus tickets ({tickets.length})
              </h2>

              {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-slate-600">
                  Cargando tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-slate-500">
                  No hay tickets cargados todavía.
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold tracking-tight text-slate-800">{ticket.title}</h3>
                          <span className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-500/20">
                            {ticket.state}
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm">{ticket.description}</p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-slate-500">
                          <div>Creado: <span className="text-slate-700">{formatDate(ticket.created_at)}</span></div>
                          {ticket.comment ? <div>Comentario: <span className="text-slate-700">{ticket.comment}</span></div> : null}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditOpen(ticket)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                          title="Editar ticket"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteConfirm(ticket)}
                          disabled={deletingId === ticket.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Eliminar ticket"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingId === ticket.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Modal crear ticket */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white shadow-xl border border-slate-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="text-[#7f19e6]">+</span>
                Crear nuevo ticket
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="sr-only">Cerrar</span>
                <span className="text-slate-500 text-xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Título *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-[#7f19e6] focus:border-[#7f19e6] p-3"
                  placeholder="Ej: Error en página Calendario"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Descripción *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-[#7f19e6] focus:border-[#7f19e6] p-3 min-h-[120px] resize-none"
                  placeholder="Describe el problema o mejora..."
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || creating}
                  className="flex items-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-lg font-bold transition-all hover:bg-teal-600 shadow-md shadow-teal-500/20 disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {creating ? 'Creando ticket...' : 'Crear ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleDeleteCancel}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar ticket?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Se eliminará el ticket &quot;{deleteConfirmTicket.title}&quot;. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmOk}
                disabled={deletingId === deleteConfirmTicket.id}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === deleteConfirmTicket.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleEditClose}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Editar ticket</h3>
              <button
                type="button"
                onClick={handleEditClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="sr-only">Cerrar</span>
                <span className="text-slate-500 text-xl leading-none">&times;</span>
              </button>
            </div>
            <form onSubmit={handleEditSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Título *</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-[#7f19e6] focus:border-[#7f19e6] p-3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción *</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-[#7f19e6] focus:border-[#7f19e6] p-3 resize-none"
                  required
                />
              </div>
              {/* Responsable se gestiona internamente, no editable por el cliente */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleEditClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingId === editingTicket.id || !editForm.title.trim() || !editForm.description.trim() || !editForm.responsible.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-60"
                >
                  {savingId === editingTicket.id ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

