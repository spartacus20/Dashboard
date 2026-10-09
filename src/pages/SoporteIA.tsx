import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSoporteIASkeleton,
  fetchSoporteIARegistros,
  SOPORTE_IA_COLUMNA_ORDER,
  SOPORTE_IA_COLUMNA_WIDTHS,
  SOPORTE_IA_FICHAS_COLUMNA_ORDER,
  SOPORTE_IA_FICHAS_COLUMNA_WIDTHS,
  SOPORTE_IA_CAMPO_FECHA,
  SOPORTE_IA_CAMPO_ID_FICHA,
  SOPORTE_IA_CAMPO_ID_INCIDENCIA,
  SOPORTE_IA_CAMPO_MOTIVO,
  SOPORTE_IA_CAMPO_USUARIO,
  SOPORTE_IA_MANT_FICHAS,
  SOPORTE_IA_MANT_INCIDENCIAS,
  type ZinkeeCampo,
  type ZinkeeRegistroDataCell,
  type ZinkeeRegistroFila,
} from '../services/api/soporteIA';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  RefreshCw,
  AlertCircle,
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useDashboardRoute, navigateDashboard } from '../lib/dashboardRoute';

type SeccionSoporteIA = 'incidencias' | 'fichas';

interface SoporteIAProps {
  onNavigate: (page: string) => void;
}

function buildDataMap(
  data: ZinkeeRegistroDataCell[],
): Map<number, ZinkeeRegistroDataCell> {
  const m = new Map<number, ZinkeeRegistroDataCell>();
  for (const c of data) {
    m.set(c.campoId, c);
  }
  return m;
}

function resolveDisplayText(
  campo: ZinkeeCampo | undefined,
  cell: ZinkeeRegistroDataCell | undefined,
): string {
  if (!cell) return '';
  if (cell.valorRel != null && String(cell.valorRel).trim() !== '') {
    return String(cell.valorRel);
  }
  const v = cell.valor;

  // Campos LV: resolver id numérico → texto (antes no se hacía y salía 3479, etc. en bruto)
  if (campo?.valores && campo.valores.length > 0) {
    if (typeof v === 'number') {
      const opt = campo.valores.find((x) => x.id === v);
      return opt ? opt.valor : '';
    }
    if (typeof v === 'string' && v.trim() !== '' && /^\d+$/.test(v.trim())) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) {
        const opt = campo.valores.find((x) => x.id === n);
        return opt ? opt.valor : '';
      }
    }
  }

  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as { formula?: string; number?: number };
    if (o.formula != null && o.formula !== '') return String(o.formula);
    if (o.number != null) {
      return String(
        Math.trunc(o.number) === o.number ? o.number : o.number,
      );
    }
  }
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return '';
}

function formatValorDetalle(
  cell: ZinkeeRegistroDataCell,
  campo: ZinkeeCampo | undefined,
): string {
  const text = resolveDisplayText(campo, cell);
  if (text) return text;
  const v = cell.valor;
  if (v == null) return '—';
  if (typeof v === 'object') {
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}

function formatIdColumn(cell: ZinkeeRegistroDataCell | undefined): string {
  if (!cell) return '—';
  const v = cell.valor;
  if (v && typeof v === 'object' && 'number' in (v as object)) {
    const n = (v as { number?: number }).number;
    if (n != null) return `ID${Number.isInteger(n) ? n : n}`;
  }
  if (typeof v === 'number') return `ID${v}`;
  if (v && typeof v === 'object' && 'formula' in (v as object)) {
    const f = String((v as { formula?: string }).formula ?? '');
    if (f) return f.startsWith('ID') ? f : `ID${f}`;
  }
  const t = resolveDisplayText(undefined, cell);
  return t ? (t.startsWith('ID') ? t : `ID${t}`) : '—';
}

function isListStyleField(campo: ZinkeeCampo | undefined, campoId: number): boolean {
  if (campoId === 4092) return false;
  if (campoId === 4088 || campoId === 4098) return false;
  if (!campo) return [4091, 4093, 4094, 4095, 4109, 4097].includes(campoId);
  if (campo.tipo === 'LV') return true;
  return !!(campo.valores && campo.valores.length > 0);
}

function MotivoCell() {
  return (
    <div
      className="flex items-center justify-center"
      title="Ver detalles (clic en la fila)"
    >
      <AlignLeft
        className="h-5 w-5 shrink-0 text-teal-500"
        strokeWidth={2}
        aria-hidden
      />
      <span className="sr-only">Motivo registrado (detalle en el panel)</span>
    </div>
  );
}

function ListaBadge({ label, priority }: { label: string; priority: 'grave' | 'normal' }) {
  if (!label) return <span className="text-gray-400">—</span>;
  if (priority === 'grave') {
    return (
      <span
        className="inline-flex max-w-full items-center rounded-md bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white shadow-sm"
        title={label}
      >
        <span className="truncate">{label}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-full items-center rounded-md border border-gray-300 bg-white px-2.5 py-0.5 text-xs text-gray-800 shadow-sm"
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function RegistroCelda({
  campoId,
  campo,
  cell,
  campoIdRegistro,
  mostrarIconoMotivo,
}: {
  campoId: number;
  campo: ZinkeeCampo | undefined;
  cell: ZinkeeRegistroDataCell | undefined;
  campoIdRegistro: number;
  mostrarIconoMotivo: boolean;
}) {
  if (mostrarIconoMotivo && campoId === SOPORTE_IA_CAMPO_MOTIVO) {
    return <MotivoCell />;
  }

  if (campoId === campoIdRegistro) {
    return (
      <span
        className="font-mono text-xs text-gray-900"
        title={formatIdColumn(cell)}
      >
        {formatIdColumn(cell)}
      </span>
    );
  }

  const text = resolveDisplayText(campo, cell);
  if (isListStyleField(campo, campoId) || (text && (campo?.tipo === 'LV' || (campo?.valores && campo.valores.length)))) {
    const isGrave = text.trim().toLowerCase() === 'grave';
    return <ListaBadge label={text} priority={isGrave ? 'grave' : 'normal'} />;
  }

  if (!text) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <span
      className="block min-w-0 truncate text-sm text-gray-900"
      title={text}
    >
      {text}
    </span>
  );
}

function RegistroDetalleDialog({
  open,
  onOpenChange,
  fila,
  campoById,
  modo,
  idCampoParaTitulo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fila: ZinkeeRegistroFila | null;
  campoById: Map<number, ZinkeeCampo>;
  modo: SeccionSoporteIA;
  idCampoParaTitulo: number;
}) {
  if (!fila) return null;

  const dataMap = buildDataMap(fila.data);
  const idDisp = dataMap.get(idCampoParaTitulo);
  const titulo = formatIdColumn(idDisp);

  if (modo === 'fichas') {
    const todos = [...fila.data].sort((a, b) => a.campoId - b.campoId);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,900px)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto p-0 gap-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-gray-200 px-6 py-4 text-left">
            <DialogTitle>Detalle del cliente · {titulo}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Datos</h3>
            <div className="max-h-[min(60vh,480px)] overflow-y-auto rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {todos.map((cell) => {
                    const campo = campoById.get(cell.campoId);
                    const nombre = campo?.nombre ?? `Campo ${cell.campoId}`;
                    return (
                      <tr key={cell.campoId}>
                        <th className="w-1/3 px-3 py-2 text-left font-medium text-gray-600 align-top">
                          {nombre}
                        </th>
                        <td className="px-3 py-2 text-gray-900 break-words whitespace-pre-wrap">
                          {formatValorDetalle(cell, campo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const motivoCell = dataMap.get(SOPORTE_IA_CAMPO_MOTIVO);
  const motivoCampo = campoById.get(SOPORTE_IA_CAMPO_MOTIVO);
  const motivoTexto = motivoCell
    ? resolveDisplayText(motivoCampo, motivoCell) ||
      (typeof motivoCell.valor === 'string' ? motivoCell.valor : '') ||
      formatValorDetalle(motivoCell, motivoCampo)
    : '';

  const demasCampos = [...fila.data]
    .filter(
      (c) =>
        c.campoId !== SOPORTE_IA_CAMPO_MOTIVO &&
        c.campoId !== SOPORTE_IA_CAMPO_FECHA &&
        c.campoId !== SOPORTE_IA_CAMPO_USUARIO,
    )
    .sort((a, b) => a.campoId - b.campoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,900px)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto p-0 gap-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-gray-200 px-6 py-4 text-left">
          <DialogTitle>Detalle del reporte · {titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-6 py-4">
          {motivoTexto ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Motivo de la incidencia
              </h3>
              <div className="rounded-md border border-gray-200 bg-slate-50 p-3 text-sm text-gray-800 whitespace-pre-wrap break-words">
                {motivoTexto}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {(() => {
              const fechaC = dataMap.get(SOPORTE_IA_CAMPO_FECHA);
              const usC = dataMap.get(SOPORTE_IA_CAMPO_USUARIO);
              return (
                <>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Fecha de creación
                    </h3>
                    <p className="text-sm text-gray-900">
                      {fechaC
                        ? formatValorDetalle(
                            fechaC,
                            campoById.get(SOPORTE_IA_CAMPO_FECHA),
                          )
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Usuario creador
                    </h3>
                    <p className="text-sm text-gray-900">
                      {usC
                        ? formatValorDetalle(
                            usC,
                            campoById.get(SOPORTE_IA_CAMPO_USUARIO),
                          )
                        : '—'}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Otros datos</h3>
            <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {demasCampos.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-gray-500" colSpan={2}>
                        Sin más campos.
                      </td>
                    </tr>
                  ) : (
                    demasCampos.map((cell) => {
                      const campo = campoById.get(cell.campoId);
                      const nombre = campo?.nombre ?? `Campo ${cell.campoId}`;
                      return (
                        <tr key={cell.campoId}>
                          <th className="w-1/3 px-3 py-2 text-left font-medium text-gray-600 align-top">
                            {nombre}
                          </th>
                          <td className="px-3 py-2 text-gray-900 break-words whitespace-pre-wrap">
                            {formatValorDetalle(cell, campo)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SoporteIA({ onNavigate: _onNavigate }: SoporteIAProps) {
  const [seccion, setSeccion] = useState<SeccionSoporteIA>('incidencias');
  const [campos, setCampos] = useState<ZinkeeCampo[]>([]);
  const [filas, setFilas] = useState<ZinkeeRegistroFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagNum, setPagNum] = useState(1);
  const [selectedFila, setSelectedFila] = useState<ZinkeeRegistroFila | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  // Deep-linking: el registro abierto vive en la URL (/dashboard/soporte-ia/<id>)
  const { detailId } = useDashboardRoute();

  const campoById = useMemo(() => {
    const m = new Map<number, ZinkeeCampo>();
    for (const c of campos) m.set(c.id, c);
    return m;
  }, [campos]);

  const campoIdRegistro =
    seccion === 'fichas' ? SOPORTE_IA_CAMPO_ID_FICHA : SOPORTE_IA_CAMPO_ID_INCIDENCIA;
  const mostrarIconoMotivo = seccion === 'incidencias';

  const load = useCallback(
    async (page: number, tab: SeccionSoporteIA) => {
      setLoading(true);
      setError(null);
      try {
        if (tab === 'incidencias') {
          const [sk, regs] = await Promise.all([
            fetchSoporteIASkeleton({ mantId: SOPORTE_IA_MANT_INCIDENCIAS }),
            fetchSoporteIARegistros({
              mantId: SOPORTE_IA_MANT_INCIDENCIAS,
              pagNum: page,
            }),
          ]);
          const c = sk?.campos;
          setCampos(Array.isArray(c) ? c : []);
          setFilas(Array.isArray(regs) ? regs : []);
        } else {
          const [sk, regs] = await Promise.all([
            fetchSoporteIASkeleton({ mantId: SOPORTE_IA_MANT_FICHAS }),
            fetchSoporteIARegistros({
              mantId: SOPORTE_IA_MANT_FICHAS,
              pagNum: page,
              confGrid: null,
            }),
          ]);
          const c = sk?.campos;
          setCampos(Array.isArray(c) ? c : []);
          setFilas(Array.isArray(regs) ? regs : []);
        }
      } catch (e) {
        setCampos([]);
        setFilas([]);
        setError(e instanceof Error ? e.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(pagNum, seccion);
  }, [load, pagNum, seccion]);

  /** Limpia la tabla y activa carga al instante (evita celdas vacías / datos cruzados al cambiar de pestaña). */
  const cambiarSeccion = (nueva: SeccionSoporteIA) => {
    if (nueva === seccion) return;
    setLoading(true);
    setError(null);
    setFilas([]);
    setCampos([]);
    setSeccion(nueva);
    setPagNum(1);
  };

  const columnas = useMemo(() => {
    const order =
      seccion === 'fichas'
        ? SOPORTE_IA_FICHAS_COLUMNA_ORDER
        : SOPORTE_IA_COLUMNA_ORDER;
    const widths =
      seccion === 'fichas'
        ? SOPORTE_IA_FICHAS_COLUMNA_WIDTHS
        : SOPORTE_IA_COLUMNA_WIDTHS;
    return order.map((id) => ({
      id,
      nombre: campoById.get(id)?.nombre ?? `Campo ${id}`,
      ancho: widths[id] ?? 120,
    }));
  }, [campoById, seccion]);

  // Abrir navegando: la URL manda y el efecto de abajo aplica el estado.
  const abrirDetalle = (fila: ZinkeeRegistroFila) => {
    navigateDashboard('soporte-ia', String(fila.id));
  };

  // Sincronizar el detalle con la URL (deep-link, atrás/adelante, recarga)
  useEffect(() => {
    if (detailId) {
      if (!selectedFila || String(selectedFila.id) !== detailId) {
        const fila = filas.find((f) => String(f.id) === detailId);
        if (fila) {
          setSelectedFila(fila);
          setDetalleOpen(true);
        }
      }
    } else if (detalleOpen) {
      setDetalleOpen(false);
      setSelectedFila(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, filas]);

  return (
    <div className="p-8 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 min-w-0">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800">Soporte IA</h1>
          <p className="text-sm text-gray-600 mt-1">
            {seccion === 'incidencias'
              ? 'Incidencias: pulsa una fila para el motivo y el detalle completo.'
              : 'Clientes: pulsa una fila para ver todos los campos.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-sm text-gray-600">Página {pagNum}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPagNum((p) => Math.max(1, p - 1))}
            disabled={loading || pagNum <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPagNum((p) => p + 1)}
            disabled={loading}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(pagNum, seccion)}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="mb-4 flex w-full min-w-0 border-b border-gray-200">
        <button
          type="button"
          onClick={() => cambiarSeccion('incidencias')}
          disabled={loading}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            seccion === 'incidencias'
              ? 'border-slate-700 text-slate-900'
              : 'border-transparent text-gray-500 hover:text-gray-800',
          )}
        >
          Incidencias
        </button>
        <button
          type="button"
          onClick={() => cambiarSeccion('fichas')}
          disabled={loading}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            seccion === 'fichas'
              ? 'border-slate-700 text-slate-900'
              : 'border-transparent text-gray-500 hover:text-gray-800',
          )}
        >
          Clientes
        </button>
      </div>

      {error && (
        <div
          className="mb-4 flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">No se pudo cargar el listado</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-red-700">
              Revisa <code className="bg-red-100 px-1 rounded">ZINKEE_EMAIL</code> y{' '}
              <code className="bg-red-100 px-1 rounded">ZINKEE_PASSWORD</code> en el
              backend.
            </p>
          </div>
        </div>
      )}

      <div className="w-full min-w-0 max-w-full rounded-sm border border-gray-200 bg-white shadow-sm">
        <div
          className="relative w-full min-w-0 max-w-full overflow-x-auto [scrollbar-gutter:stable] min-h-[220px]"
        >
          {loading && filas.length === 0 && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px] animate-in fade-in duration-200"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2
                className="h-8 w-8 text-slate-600 animate-spin"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-sm font-medium text-slate-700">Cargando datos…</p>
            </div>
          )}
          <table
            className={cn(
              'w-full min-w-0 table-fixed border-collapse text-left text-sm',
              loading && filas.length === 0 && 'opacity-40 pointer-events-none',
            )}
          >
            <colgroup>
              {columnas.map((col) => (
                <col key={col.id} style={{ width: col.ancho }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-700 text-white">
                {columnas.map((col) => (
                  <th
                    key={col.id}
                    className="bg-slate-700 border-b border-slate-600/80 px-2 py-2.5 font-semibold text-xs"
                    title={col.nombre}
                  >
                    <span className="block truncate">{col.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && filas.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, columnas.length)}
                    className="h-48 p-0 align-middle"
                    aria-hidden
                  >
                    <span className="sr-only">Cargando datos</span>
                  </td>
                </tr>
              ) : !loading && filas.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnas.length}
                    className="p-10 text-center text-gray-500"
                  >
                    No hay filas en esta página.
                  </td>
                </tr>
              ) : (
                filas.map((fila) => {
                  const dataMap = buildDataMap(fila.data);
                  return (
                    <tr
                      key={fila.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirDetalle(fila)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          abrirDetalle(fila);
                        }
                      }}
                      className="cursor-pointer border-b border-gray-200 bg-white hover:bg-slate-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset"
                    >
                      {columnas.map((col) => {
                        const c = dataMap.get(col.id);
                        return (
                          <td
                            key={`${fila.id}-${col.id}`}
                            className="px-2 py-1.5 align-middle border-b border-gray-100 overflow-hidden"
                          >
                            <RegistroCelda
                              campoId={col.id}
                              campo={campoById.get(col.id)}
                              cell={c}
                              campoIdRegistro={campoIdRegistro}
                              mostrarIconoMotivo={mostrarIconoMotivo}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filas.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          Mostrando {filas.length} registro{filas.length === 1 ? '' : 's'} · página {pagNum}
        </p>
      )}

      <RegistroDetalleDialog
        open={detalleOpen}
        onOpenChange={(o) => {
          // Cerrar quita el id de la URL; el efecto sincroniza el estado.
          if (!o) navigateDashboard('soporte-ia');
        }}
        fila={selectedFila}
        campoById={campoById}
        modo={seccion}
        idCampoParaTitulo={campoIdRegistro}
      />
    </div>
  );
}
