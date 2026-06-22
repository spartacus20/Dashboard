import React from "react";
import { toast } from "sonner";
import {
  X,
  Upload,
  Phone,
  Info,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useCallsContext } from "../context/CallsContext";
import { fetchBatchCallTasks, deleteBatchCall } from "../api";
import type { RetellBatchCall, BatchCallTask } from "../types";
import { CreateBatchCallForm } from "../components/batch/CreateBatchCallForm";

export // Componente de página en blanco para Batch Call
function BatchCall({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    apiKey,
    clientId,
    phoneNumbers,
    loadingPhoneNumbers,
    loadPhoneNumbers,
    batchCalls,
    loadingBatchCalls,
    loadBatchCalls,
    refreshBatchCalls,
    noBatchCallsAvailable,
    batchCallsLoaded,
  } = useCallsContext();

  const noPhoneNumbersAvailable =
    !loadingPhoneNumbers && phoneNumbers.length === 0;

  // Estado para el modal de tareas
  const [selectedBatch, setSelectedBatch] =
    React.useState<RetellBatchCall | null>(null);
  const [tasks, setTasks] = React.useState<BatchCallTask[]>([]);
  const [taskKeys, setTaskKeys] = React.useState<string[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState<boolean>(false);
  const [tasksError, setTasksError] = React.useState<string | null>(null);
  const [showTasksModal, setShowTasksModal] = React.useState<boolean>(false);

  // Estado para el modal de confirmación de eliminación
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] =
    React.useState<boolean>(false);
  const [batchToDelete, setBatchToDelete] =
    React.useState<RetellBatchCall | null>(null);
  const [deletingBatch, setDeletingBatch] = React.useState<boolean>(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Función para cargar las tareas de una batch call
  const loadBatchTasks = React.useCallback(async (batch: RetellBatchCall) => {
    setSelectedBatch(batch);
    setShowTasksModal(true);
    setLoadingTasks(true);
    setTasksError(null);

    try {
      const tasksData = await fetchBatchCallTasks(batch.tasks_url);
      setTasks(tasksData);

      // Calcular las claves una sola vez
      if (tasksData.length > 0) {
        const allKeys = Object.keys(
          tasksData.reduce((acc, task) => ({ ...acc, ...task }), {}),
        );
        setTaskKeys(allKeys);
      } else {
        setTaskKeys([]);
      }
    } catch (err) {
      // console.error("Error al cargar tareas:", err);
      setTasksError(
        err instanceof Error ? err.message : "Error al cargar las tareas",
      );
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // Función para iniciar la eliminación de un batch call
  const handleDeleteBatchClick = React.useCallback(
    (batch: RetellBatchCall, event: React.MouseEvent) => {
      event.stopPropagation(); // Evitar que se abra el modal de tareas
      setBatchToDelete(batch);
      setDeleteConfirmModalOpen(true);
      setDeleteError(null);
    },
    [],
  );

  // Función para confirmar y ejecutar la eliminación
  const confirmDeleteBatch = React.useCallback(async () => {
    if (!clientId || !batchToDelete) return;

    setDeletingBatch(true);
    setDeleteError(null);

    try {
      const response = await deleteBatchCall(
        clientId,
        batchToDelete.batch_call_id,
        batchToDelete.workspace_index,
      );
      // console.log('Respuesta de eliminación:', response);

      // Si llegamos aquí, la eliminación fue exitosa (incluso con 204)

      toast.success("Batch call eliminado correctamente");

      // Actualizar la lista después de eliminar usando el contexto
      refreshBatchCalls();

      // Cerrar el modal
      setDeleteConfirmModalOpen(false);
      setBatchToDelete(null);
    } catch (err) {
      // console.error("Error al eliminar batch call:", err);
      setDeleteError(
        err instanceof Error ? err.message : "Error al eliminar la campaña",
      );
    } finally {
      setDeletingBatch(false);
    }
  }, [apiKey, batchToDelete, refreshBatchCalls]);

  // Función para cerrar el modal de confirmación
  const closeDeleteConfirmModal = React.useCallback(() => {
    setDeleteConfirmModalOpen(false);
    setBatchToDelete(null);
    setDeleteError(null);
  }, []);

  // Función para cerrar el modal de tareas
  const closeTasksModal = React.useCallback(() => {
    setShowTasksModal(false);
  }, []);

  // Función para formatear timestamp a fecha legible
  const formatDate = React.useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Función para calcular el porcentaje
  const calculatePercentage = React.useCallback(
    (value: number, total: number) => {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    },
    [],
  );

  // Función auxiliar para renderizar diferentes tipos de valores de la tarea
  const renderTaskValue = React.useCallback((value: any): React.ReactNode => {
    if (value === undefined || value === null) {
      return <span className="text-gray-500">-</span>;
    }

    if (typeof value === "boolean") {
      return value ? "Sí" : "No";
    }

    if (typeof value === "number") {
      // Si parece un timestamp, formatear como fecha
      if (value > 1000000000000) {
        // Asumimos que es un timestamp en milisegundos
        return new Date(value).toLocaleString("es-ES");
      }
      return value.toString();
    }

    if (typeof value === "string") {
      // Si es un string JSON, mostrarlo con formato
      if (
        (value.startsWith("{") && value.endsWith("}")) ||
        (value.startsWith("[") && value.endsWith("]"))
      ) {
        try {
          const parsed = JSON.parse(value);
          return (
            <div className="max-w-xs overflow-hidden text-ellipsis">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                {JSON.stringify(parsed, null, 2).substring(0, 50)}
                {JSON.stringify(parsed).length > 50 ? "..." : ""}
              </pre>
            </div>
          );
        } catch (e) {
          // Si no se puede parsear, mostrar como string normal
          return value;
        }
      }
      return value;
    }

    if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (value.length === 0)
          return <span className="text-gray-500">[]</span>;
        return (
          <div className="max-w-xs overflow-hidden text-ellipsis">
            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
              {JSON.stringify(value, null, 2).substring(0, 50)}
              {JSON.stringify(value).length > 50 ? "..." : ""}
            </pre>
          </div>
        );
      }

      return (
        <div className="max-w-xs overflow-hidden text-ellipsis">
          <pre className="text-xs text-gray-400 whitespace-pre-wrap">
            {JSON.stringify(value, null, 2).substring(0, 50)}
            {JSON.stringify(value).length > 50 ? "..." : ""}
          </pre>
        </div>
      );
    }

    return String(value);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Llamadas en Lote</h2>
        <div className="flex flex-wrap items-center gap-2 text-gray-400">
          <p>Gestiona y visualiza campañas de llamadas programadas</p>
        </div>
      </div>

      {/* Formulario para crear nuevas campañas */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg mb-8">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold text-white">Crear Nueva Campaña</h3>
          <p className="text-sm text-gray-400 mt-1">
            Carga un archivo CSV con números de teléfono para crear una nueva
            campaña
          </p>
        </div>
        <div className="p-6">
          <CreateBatchCallForm
            apiKey={apiKey}
            onSuccess={refreshBatchCalls}
            phoneNumbers={phoneNumbers}
            loadingPhones={loadingPhoneNumbers}
            noPhoneNumbersAvailable={noPhoneNumbersAvailable}
          />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold text-white">Campañas de Llamadas</h3>
          <p className="text-sm text-gray-400 mt-1">
            Listado de campañas de llamadas programadas y su estado actual
          </p>
        </div>
        <div className="p-6">
          {loadingBatchCalls ? (
            <div className="flex justify-center items-center py-12">
              <div className="flex items-center space-x-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
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
                <span className="text-white">Cargando datos...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => refreshBatchCalls()}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : noBatchCallsAvailable && batchCallsLoaded ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600 mb-4"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 7h10" />
                  <path d="M7 12h10" />
                  <path d="M7 17h10" />
                </svg>
                <h3 className="text-xl font-medium text-gray-200 mb-2">
                  No hay campañas disponibles
                </h3>
                <p className="text-gray-400 mb-6 max-w-md text-center">
                  No se han encontrado campañas de batch calling para esta API
                  key. Puedes crear una nueva campaña desde el formulario
                  superior.
                </p>
              </div>
            </div>
          ) : batchCalls.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">
                No hay campañas de llamadas programadas.
              </p>
              <button
                onClick={() => onNavigate("phones")}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Ir a Números de Teléfono
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-800">
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Nombre
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Estado
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Número
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Programación
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Total
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Enviadas
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Contestadas
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Completadas
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Último envío
                    </th>
                    <th className="p-3 text-sm font-medium text-gray-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batchCalls.map((batch) => (
                    <tr
                      key={batch.batch_call_id}
                      className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                      onClick={() => loadBatchTasks(batch)}
                    >
                      <td className="p-3 text-white font-medium">
                        {batch.name}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            batch.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : batch.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {batch.status === "sent"
                            ? "Enviada"
                            : batch.status === "pending"
                              ? "Pendiente"
                              : batch.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-300">{batch.from_number}</td>
                      <td className="p-3 text-gray-300">
                        {formatDate(batch.scheduled_timestamp)}
                      </td>
                      <td className="p-3 text-gray-300">
                        {batch.total.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <span className="text-gray-300 mr-2">
                            {batch.sent.toLocaleString()}
                          </span>
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${calculatePercentage(batch.sent, batch.total)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <span className="text-gray-300 mr-2">
                            {batch.picked_up.toLocaleString()}
                          </span>
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${calculatePercentage(batch.picked_up, batch.total)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <span className="text-gray-300 mr-2">
                            {batch.completed.toLocaleString()}
                          </span>
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full"
                              style={{
                                width: `${calculatePercentage(batch.completed, batch.total)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-gray-300">
                        {formatDate(batch.last_sent_timestamp)}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => handleDeleteBatchClick(batch, e)}
                          className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                          title="Eliminar campaña"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal para mostrar las tareas */}
      {showTasksModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedBatch.name}
                </h2>
                <p className="text-sm text-gray-400">
                  Campaña: {selectedBatch.batch_call_id}
                </p>
              </div>
              <button
                onClick={closeTasksModal}
                className="p-1 hover:bg-gray-800 rounded-full"
              >
                <X className="w-6 h-6 text-gray-400 hover:text-white" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex-grow">
              {loadingTasks ? (
                <div className="flex justify-center items-center py-12">
                  <div className="flex items-center space-x-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
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
                    <span className="text-white">Cargando tareas...</span>
                  </div>
                </div>
              ) : tasksError ? (
                <div className="text-center py-12">
                  <p className="text-red-500 mb-4">{tasksError}</p>
                  <button
                    onClick={() => loadBatchTasks(selectedBatch!)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">
                    No hay tareas disponibles para esta campaña.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        Lista de Tareas
                      </h3>
                      <p className="text-sm text-gray-400">
                        {tasks.length} tareas en total
                      </p>
                    </div>
                  </div>

                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-gray-800">
                        {/* Usar las claves pre-calculadas para los encabezados */}
                        {taskKeys.map((key) => (
                          <th
                            key={key}
                            className="p-3 text-sm font-medium text-gray-400"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task, index) => (
                        <tr
                          key={task.id || index}
                          className="border-b border-gray-800 hover:bg-gray-800/50"
                        >
                          {/* Usar las claves pre-calculadas para las celdas */}
                          {taskKeys.map((key) => (
                            <td
                              key={`${index}-${key}`}
                              className="p-3 text-gray-300"
                            >
                              {renderTaskValue(task[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar campaña */}
      {deleteConfirmModalOpen && batchToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <div className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2" size={20} />
                <h3 className="text-lg font-bold text-white">
                  Confirmar eliminación
                </h3>
              </div>
              <button
                onClick={closeDeleteConfirmModal}
                className="p-1 hover:bg-gray-800 rounded-full"
                disabled={deletingBatch}
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-300">
                ¿Estás seguro de que quieres eliminar la campaña{" "}
                <span className="font-bold text-white">
                  {batchToDelete.name}
                </span>
                ?
              </p>
              <p className="text-gray-400 text-sm">
                Esta acción no se puede deshacer y eliminará permanentemente
                esta campaña y todos sus datos asociados.
              </p>

              {deleteError && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={closeDeleteConfirmModal}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                  disabled={deletingBatch}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteBatch}
                  disabled={deletingBatch}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                >
                  {deletingBatch ? (
                    <>
                      <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-1" />
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
