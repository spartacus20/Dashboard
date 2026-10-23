import { useEffect, useState } from 'react';
import { ArrowRight, Flag, Plus, Trash2, Wrench, X } from 'lucide-react';
import type { RetellLLMEdge, RetellLLMState } from '../../services/api/agents';

interface StageSettingsCardProps {
  state: RetellLLMState;
  stateNames: string[];
  isStarting: boolean;
  canDelete: boolean;
  /** Devuelve false si el nombre no es válido (el input vuelve al nombre actual). */
  onRename: (name: string) => boolean;
  onSetStarting: () => void;
  onDelete: () => void;
  onAddEdge: () => void;
  onUpdateEdge: (index: number, patch: Partial<RetellLLMEdge>) => void;
  onRemoveEdge: (index: number) => void;
  onGoTo: (name: string) => void;
}

// Configuración de un stage: nombre, si es el inicial, transiciones y tools (solo lectura).
export function StageSettingsCard({
  state, stateNames, isStarting, canDelete,
  onRename, onSetStarting, onDelete, onAddEdge, onUpdateEdge, onRemoveEdge, onGoTo,
}: StageSettingsCardProps) {
  const [nameInput, setNameInput] = useState(state.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setNameInput(state.name); }, [state.name]);

  const commitName = () => {
    if (!onRename(nameInput)) setNameInput(state.name);
  };

  const destinations = stateNames.filter(n => n !== state.name);
  const edges = state.edges ?? [];

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
      {/* Nombre + acciones */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-gray-700">Nombre del stage</span>
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="block text-[10px] text-gray-400 mt-1">Letras, números, _ y -. Las transiciones que apuntan acá se actualizan solas.</span>
        </label>
        <div className="flex items-center gap-2 pb-5">
          {isStarting ? (
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
              <Flag className="w-3.5 h-3.5" />Stage inicial
            </span>
          ) : (
            <button onClick={onSetStarting}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-green-50 hover:border-green-300 text-gray-600 hover:text-green-700 text-xs font-medium transition-colors">
              <Flag className="w-3.5 h-3.5" />Marcar como inicial
            </button>
          )}
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-gray-600">¿Eliminar?</span>
              <button onClick={() => { setConfirmDelete(false); onDelete(); }}
                className="px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">Sí</button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} disabled={!canDelete}
              title={canDelete ? 'Eliminar stage' : 'El agente necesita al menos un stage'}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none">
              <Trash2 className="w-3.5 h-3.5" />Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Transiciones */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Transiciones</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">A qué stage pasa el agente y cuándo. Sin transiciones, es un stage final.</p>
        </div>
        <button onClick={onAddEdge} disabled={destinations.length === 0}
          title={destinations.length === 0 ? 'Agregá otro stage primero' : undefined}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-700 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none">
          <Plus className="w-3.5 h-3.5" />Agregar
        </button>
      </div>
      {edges.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {edges.map((edge, i) => {
            const destExists = stateNames.includes(edge.destination_state_name);
            return (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <ArrowRight className="w-4 h-4 mt-2.5 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={destExists ? edge.destination_state_name : ''}
                      onChange={e => onUpdateEdge(i, { destination_state_name: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {!destExists && <option value="">Elegí un destino…</option>}
                      {destinations.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {destExists && (
                      <button onClick={() => onGoTo(edge.destination_state_name)}
                        className="text-xs text-blue-700 hover:underline">Ir al stage</button>
                    )}
                  </div>
                  <textarea
                    value={edge.description ?? ''}
                    onChange={e => onUpdateEdge(i, { description: e.target.value })}
                    rows={2}
                    placeholder="Cuándo pasar a este stage (ej: el usuario confirma que quiere agendar)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 resize-y focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
                  />
                </div>
                <button onClick={() => onRemoveEdge(i)} title="Quitar transición"
                  className="mt-1.5 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Tools (solo lectura) */}
      {state.tools?.length ? (
        <div className="px-5 py-3 border-t border-gray-100">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Tools (se editan desde Retell)</div>
          <div className="flex flex-wrap gap-1.5">
            {state.tools.map((tool, i) => (
              <span key={i} title={tool.description}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono">
                <Wrench className="w-3 h-3 text-gray-400" />{tool.name || tool.type || 'tool'}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
