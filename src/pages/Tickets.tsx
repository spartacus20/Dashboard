import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createTicket, deleteTicket, fetchTickets, updateTicket } from '../api';
import { Ticket } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { AlertCircle, ClipboardList, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';

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
  const [form, setForm] = useState({ title: '', description: '' });
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar tickets');
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
      setError('No se encontrÃ³ client_id de sesiÃ³n.');
      return;
    }
    if (!canSubmit) return;

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await createTicket({
        client_id: clientId,
        title: form.title.trim(),
        description: form.description.trim(),
        responsible: 'Sin asignar',
      });
      setForm({ title: '', description: '' });
      setSuccess('Ticket creado correctamente con estado Pendiente.');
      await loadTickets();
      setShowCreateModal(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear ticket');
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar ticket');
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
        responsible: editForm.responsible.trim() || ticket.responsible,
        state: editForm.state || 'Pendiente',
      });
      setSuccess('Ticket actualizado correctamente.');
      handleEditClose();
      await loadTickets();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar ticket');
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

  if (!clientId) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center text-slate-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No hay client_id de sesiÃ³n. Inicia sesiÃ³n para ver los tickets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Tickets</h2>
        <p className="text-slate-600">Reporta errores o incidencias que hayas detectado</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mb-6">
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            onClick={loadTickets}
            disabled={loading}
            variant={loading ? 'secondary' : 'default'}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar datos
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setShowCreateModal(true);
            }}
            variant="default"
          >
            <Send className="h-4 w-4 mr-2" />
            Crear ticket
          </Button>
        </div>
      </div>

      {(error || success) && (
        <div className="space-y-2 mb-6">
          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
              {success}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#7f19e6]" />
            Tus tickets ({tickets.length})
          </h3>
        </div>
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-slate-600">Cargando tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              No hay tickets cargados todavÃ­a.
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
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          (ticket.state || '').toLowerCase().includes('completado')
                            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                            : (ticket.state || '').toLowerCase().includes('progreso')
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {ticket.state}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm">{ticket.description}</p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs font-medium text-slate-500">
                          <div>Creado: <span className="text-slate-700">{formatDate(ticket.created_at)}</span></div>
                        </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditOpen(ticket)}
                      title="Editar ticket"
                      className="gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteConfirm(ticket)}
                      disabled={deletingId === ticket.id}
                      title="Eliminar ticket"
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === ticket.id ? 'Eliminando...' : 'Eliminar'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
                <label className="text-sm font-semibold text-slate-700">Titulo *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:ring-[#7f19e6] focus:border-[#7f19e6] p-3"
                  placeholder="Ej: Error en pÃ¡gina Calendario"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit || creating}
                  variant={creating ? 'secondary' : 'default'}
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Crear ticket
                    </>
                  )}
                </Button>
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
            <h3 className="text-lg font-bold text-slate-800 mb-2">Â¿Eliminar ticket?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Se eliminarÃ¡ el ticket &quot;{deleteConfirmTicket.title}&quot;. Esta acciÃ³n no se puede deshacer.
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Titulo *</label>
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
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleEditClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingId === editingTicket.id || !editForm.title.trim() || !editForm.description.trim()}
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
