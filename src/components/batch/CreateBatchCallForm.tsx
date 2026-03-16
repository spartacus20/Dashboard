import React, { useState, useRef, ChangeEvent } from "react";
import { Phone, Upload, Check, Info, RefreshCw } from "lucide-react";
import { createBatchCall } from "../../api";
import type { RetellPhoneNumber } from "../../types";

export // Componente para crear nuevas campañas de llamadas en lote
interface CreateBatchCallFormProps {
  apiKey: string | null;
  onSuccess?: () => void;
  phoneNumbers: RetellPhoneNumber[];
  loadingPhones: boolean;
  noPhoneNumbersAvailable: boolean;
}

export function CreateBatchCallForm({
  apiKey,
  onSuccess,
  phoneNumbers,
  loadingPhones,
  noPhoneNumbersAvailable,
}: CreateBatchCallFormProps) {
  const [fromNumber, setFromNumber] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [phoneColumnIndex, setPhoneColumnIndex] = useState<number>(-1);
  const [columnMappings, setColumnMappings] = useState<{
    [key: string]: number;
  }>({});
  const [useManualNumber, setUseManualNumber] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seleccionar el primer número por defecto cuando los números de teléfono se cargan
  React.useEffect(() => {
    if (phoneNumbers.length > 0 && !fromNumber && !useManualNumber) {
      setFromNumber(phoneNumbers[0].phone_number);
    }
  }, [phoneNumbers, fromNumber, useManualNumber]);

  // Si no hay números disponibles, activar modo manual directamente
  React.useEffect(() => {
    if (
      (noPhoneNumbersAvailable ||
        (phoneNumbersLoaded && phoneNumbers.length === 0)) &&
      !useManualNumber
    ) {
      // console.log('No hay números de teléfono disponibles, activando modo manual');
      setUseManualNumber(true);
    }
  }, [
    phoneNumbers,
    phoneNumbersLoaded,
    noPhoneNumbersAvailable,
    useManualNumber,
  ]);

  // Función para manejar la selección de archivo CSV
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setError(null);

    // Leer el archivo para previsualización
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split("\n").filter((line) => line.trim() !== "");

        if (lines.length === 0) {
          setError("El archivo CSV está vacío");
          return;
        }

        // Analizar CSV (suponiendo que está separado por comas)
        const parsedData = lines.map((line) => {
          return line
            .split(",")
            .map((cell) => cell.trim().replace(/^"|"$/g, ""));
        });

        setPreviewData(parsedData);

        // Detectar automáticamente la columna del número de teléfono
        const headers = parsedData[0];
        const phoneColIndex = headers.findIndex(
          (header) =>
            header.toLowerCase().includes("phone") ||
            header.toLowerCase().includes("teléfono") ||
            header.toLowerCase().includes("telefono") ||
            header.toLowerCase().includes("móvil") ||
            header.toLowerCase().includes("movil") ||
            header.toLowerCase().includes("celular") ||
            header.toLowerCase().includes("número") ||
            header.toLowerCase().includes("numero"),
        );

        if (phoneColIndex !== -1) {
          setPhoneColumnIndex(phoneColIndex);
        }

        // Detectar posibles variables dinámicas (usando encabezados)
        if (parsedData.length > 0) {
          const detectedVars = parsedData[0].filter(
            (header) =>
              header.toLowerCase() !== "phone" &&
              header.toLowerCase() !== "teléfono" &&
              header.toLowerCase() !== "telefono" &&
              header.toLowerCase() !== "número" &&
              header.toLowerCase() !== "numero" &&
              header.toLowerCase() !== "móvil" &&
              header.toLowerCase() !== "movil" &&
              header.toLowerCase() !== "celular" &&
              header.trim() !== "",
          );

          setVariables(detectedVars);

          // Crear mapeo inicial de columnas
          const initialMappings: { [key: string]: number } = {};
          detectedVars.forEach((varName) => {
            const colIndex = parsedData[0].findIndex((h) => h === varName);
            if (colIndex !== -1) {
              initialMappings[varName] = colIndex;
            }
          });

          setColumnMappings(initialMappings);
        }
      } catch (err) {
        // console.error("Error al procesar el CSV:", err);
        setError("Error al procesar el archivo CSV");
      }
    };

    reader.onerror = () => {
      setError("Error al leer el archivo CSV");
    };

    reader.readAsText(file);
  };

  // Función para manejar el cambio de la columna de teléfono
  const handlePhoneColumnChange = (index: number) => {
    setPhoneColumnIndex(index);
  };

  // Función para manejar la creación de la campaña
  const handleCreateBatchCall = async () => {
    if (!apiKey) {
      setError("API key no configurada");
      return;
    }

    if (!fromNumber) {
      setError("El número de origen es obligatorio");
      return;
    }

    if (!csvFile) {
      setError("Debes cargar un archivo CSV");
      return;
    }

    if (phoneColumnIndex === -1) {
      setError(
        "Debes seleccionar la columna que contiene los números de teléfono",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Preparar las tareas para la API
      // Omitir la primera fila (encabezados)
      const tasks = previewData
        .slice(1)
        .map((row) => {
          let phoneNumber = row[phoneColumnIndex];
          if (!phoneNumber) return null;

          // Verificar si el número de teléfono comienza con "+" y añadirlo si no lo tiene
          phoneNumber = phoneNumber.trim();
          if (!phoneNumber.startsWith("+")) {
            phoneNumber = "+" + phoneNumber;
          }

          const task: {
            to_number: string;
            retell_llm_dynamic_variables?: Record<string, string>;
          } = {
            to_number: phoneNumber,
          };

          // Añadir variables dinámicas si hay mapeos definidos
          if (Object.keys(columnMappings).length > 0) {
            const vars: Record<string, string> = {};

            Object.entries(columnMappings).forEach(([varName, colIndex]) => {
              if (colIndex >= 0 && colIndex < row.length) {
                vars[varName] = row[colIndex];
              }
            });

            if (Object.keys(vars).length > 0) {
              task.retell_llm_dynamic_variables = vars;
            }
          }

          return task;
        })
        .filter(Boolean) as {
        to_number: string;
        retell_llm_dynamic_variables?: Record<string, string>;
      }[];

      if (tasks.length === 0) {
        throw new Error(
          "No se encontraron números de teléfono válidos en el CSV",
        );
      }

      // Enviar la solicitud a la API con el nombre de la campaña
      const result = await createBatchCall(
        apiKey,
        fromNumber,
        tasks,
        campaignName,
      );

      setSuccess(
        `Campaña creada con éxito. ID: ${result.batch_call_id || "N/A"}`,
      );

      // Limpiar el formulario
      setFromNumber("");
      setCampaignName("");
      setCsvFile(null);
      setPreviewData([]);
      setPhoneColumnIndex(-1);
      setColumnMappings({});
      setVariables([]);

      // Resetear el input de archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Notificar éxito al componente padre
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // console.error("Error al crear la campaña:", err);
      setError(
        err instanceof Error ? err.message : "Error al crear la campaña",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-gray-400 mb-1">
            Nombre de la campaña *
          </label>
          <div className="flex">
            <div className="relative flex-grow">
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Mi Campaña"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                required
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Nombre identificativo para la campaña de llamadas
          </p>
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Número de origen *</label>
          <div className="flex">
            <div className="relative flex-grow">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              {loadingPhones ? (
                <div className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 flex items-center">
                  <RefreshCw className="animate-spin w-4 h-4 mr-2" />
                  Cargando números...
                </div>
              ) : phoneNumbers.length > 0 && !useManualNumber ? (
                <div className="relative w-full">
                  <select
                    value={fromNumber}
                    onChange={(e) => setFromNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none"
                    required
                  >
                    <option value="" disabled>
                      Selecciona un número
                    </option>
                    {phoneNumbers.map((phone) => (
                      <option
                        key={phone.phone_number}
                        value={phone.phone_number}
                      >
                        {phone.phone_number} - {phone.nickname || "Sin nombre"}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-2">
                    <button
                      type="button"
                      onClick={() => setUseManualNumber(true)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                      title="Introducir número manualmente"
                    >
                      Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full">
                  <input
                    type="text"
                    value={fromNumber}
                    onChange={(e) => setFromNumber(e.target.value)}
                    placeholder="+34960461158"
                    className={`w-full pl-10 pr-4 py-2 bg-gray-800 border ${noPhoneNumbersAvailable ? "border-yellow-700" : "border-gray-700"} rounded-lg text-white`}
                    required
                  />
                  {phoneNumbers.length > 0 && (
                    <div className="absolute right-2 top-2">
                      <button
                        type="button"
                        onClick={() => setUseManualNumber(false)}
                        className="text-xs text-purple-400 hover:text-purple-300"
                        title="Usar números disponibles"
                      >
                        Usar lista
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {noPhoneNumbersAvailable ||
            (phoneNumbersLoaded && phoneNumbers.length === 0) ? (
              <span className="text-yellow-500">
                Esta API key no tiene números de teléfono asociados. Debes
                introducir un número manualmente.
              </span>
            ) : (
              "Número desde el que se realizarán las llamadas"
            )}
          </p>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">
            Archivo CSV con números *
          </label>
          <div className="flex items-center">
            <label className="flex-grow cursor-pointer">
              <div className="relative">
                <div
                  className={`w-full px-4 py-2 border ${csvFile ? "border-purple-600 bg-gray-800" : "border-gray-700 bg-gray-800"} rounded-lg flex items-center`}
                >
                  <Upload className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-300 truncate">
                    {csvFile ? csvFile.name : "Seleccionar archivo CSV..."}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            El archivo debe tener una columna con números de teléfono
          </p>
        </div>
      </div>

      {/* Previsualización del CSV y mapeo de columnas */}
      {previewData.length > 0 && (
        <div className="mt-5 space-y-4">
          <div>
            <h4 className="text-white font-medium mb-1">
              Previsualización de datos
            </h4>
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    {previewData[0].map((header, index) => (
                      <th
                        key={index}
                        className={`px-3 py-2 text-left text-xs font-medium ${
                          index === phoneColumnIndex
                            ? "text-purple-400 border-b-2 border-purple-400"
                            : "text-gray-400"
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{header}</span>
                          <button
                            onClick={() => handlePhoneColumnChange(index)}
                            title={
                              index === phoneColumnIndex
                                ? "Columna seleccionada para números de teléfono"
                                : "Usar como columna de números de teléfono"
                            }
                            className={`p-1 rounded-full ${
                              index === phoneColumnIndex
                                ? "bg-purple-700/30 text-purple-300"
                                : "hover:bg-gray-700 text-gray-500"
                            }`}
                          >
                            <Phone className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 bg-gray-800">
                  {previewData.slice(1, 5).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={
                        rowIndex % 2 === 0 ? "bg-gray-800" : "bg-gray-850"
                      }
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`px-3 py-2 text-xs ${
                            cellIndex === phoneColumnIndex
                              ? "text-purple-300"
                              : "text-gray-300"
                          }`}
                        >
                          {cell || <span className="text-gray-500">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 5 && (
                <div className="text-center py-2 text-xs text-gray-500">
                  Mostrando 4 de {previewData.length - 1} filas
                </div>
              )}
            </div>
          </div>

          {/* Variables dinámicas */}
          {variables.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-1">
                Variables dinámicas detectadas
              </h4>
              <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-400 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  Estas variables se enviarán junto con cada número de teléfono
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {variables.map((variable, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-white">{variable}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensajes de error y éxito */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-300 text-sm">
          {success}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex justify-end pt-3">
        <button
          onClick={() => {
            setCsvFile(null);
            setPreviewData([]);
            setPhoneColumnIndex(-1);
            setColumnMappings({});
            setVariables([]);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 mr-2"
          disabled={loading}
        >
          Limpiar
        </button>
        <button
          onClick={handleCreateBatchCall}
          disabled={
            loading ||
            !fromNumber ||
            !csvFile ||
            phoneColumnIndex === -1 ||
            !campaignName.trim()
          }
          className={`px-4 py-2 rounded-lg text-white flex items-center ${
            loading ||
            !fromNumber ||
            !csvFile ||
            phoneColumnIndex === -1 ||
            !campaignName.trim()
              ? "bg-purple-700/50 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
              Procesando...
            </>
          ) : (
            <>
              <Phone className="h-4 w-4 mr-1" />
              Crear campaña
            </>
          )}
        </button>
      </div>
    </div>
  );
}
