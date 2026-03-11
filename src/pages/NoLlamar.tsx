import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  PhoneOff, 
  Search, 
  Download, 
  RefreshCw, 
  Calendar,
  Filter,
  User,
  Phone,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { DontCall } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { listDontCallRecords, getClientApiKey } from '../api';
import { useUserData } from '../hooks/useUserData';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

const NoLlamar: React.FC = () => {
  const { dontCallEnabled } = useCallsContext();
  const { apiKey: userApiKey, clientId } = useUserData();
  const [dontCallRecords, setDontCallRecords] = useState<DontCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [apiKey, setApiKey] = useState<string | null>(userApiKey);
  const recordsPerPage = 50;
  const [exporting, setExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'page' | 'all' | 'custom'>('page');
  const [customExportCount, setCustomExportCount] = useState<string>('');

  // Efecto para obtener la API key si no está disponible
  useEffect(() => {
    const fetchApiKey = async () => {
      if (!apiKey && clientId) {
        // console.log('🔑 Obteniendo API key para client_id:', clientId);
        try {
          const result = await getClientApiKey(clientId);
          if (result.apiKey) {
            // console.log('✅ API key obtenida:', result.apiKey);
            setApiKey(result.apiKey);
          } else {
            // console.error('❌ No se pudo obtener la API key');
            setError('No se pudo obtener la API key del cliente');
          }
        } catch (err) {
          // console.error('❌ Error al obtener API key:', err);
          setError('Error al obtener la API key del cliente');
        }
      }
    };

    fetchApiKey();
  }, [apiKey, clientId]);

  // Construir parámetros comunes para la API de No Llamar
  const buildDontCallParams = (perPage: number, page: number) => {
    const params: any = {
      client_id: clientId,
      per_page: perPage,
      page,
      sort_order: 'DESC'
    };

    // Aplicar filtros
    if (searchTerm) {
      params.search_term = searchTerm;
    }

    if (dateFrom) {
      params.fecha_inicio = `${dateFrom}T00:00:00.000Z`;
    }

    if (dateTo) {
      params.fecha_fin = `${dateTo}T23:59:59.999Z`;
    }

    return params;
  };

  // Función para cargar los registros de "No Llamar"
  const loadDontCallRecords = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      if (!apiKey || !clientId) {
        // console.log('⏳ Esperando API key o client ID...', { apiKey: !!apiKey, clientId: !!clientId });
        setLoading(false);
        return;
      }

      const params = buildDontCallParams(recordsPerPage, page);

      // console.log('🔍 Cargando registros de No Llamar con parámetros:', params);

      // Llamar al endpoint del backend
      const response = await listDontCallRecords(apiKey, params);

      // console.log('📊 Respuesta del backend:', response);

      setDontCallRecords(response.registros || []);
      setTotalRecords(response.total_registros || 0);
      setTotalPages(response.total_paginas || 0);
      setCurrentPage(response.pagina_actual || 1);

    } catch (err) {
      // console.error('Error al cargar registros de No Llamar:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los registros');
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para generar y descargar un CSV dado un conjunto de registros
  const downloadDontCallCSV = (records: DontCall[], filenameSuffix: string) => {
    const headers = [
      'ID',
      'Teléfono',
      'Nombre',
      'Campaña',
      'Región',
      'Fecha Creación'
    ];

    const csvContent = [
      headers.join(','),
      ...records.map(record => [
        record.id,
        `"${record.phone_number}"`,
        `"${record.name || ''}"`,
        `"${record.campaña || ''}"`,
        `"${record.region || ''}"`,
        `"${new Date(record.created_at).toLocaleDateString('es-ES')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `no_llamar_${filenameSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para exportar a CSV con selección de cantidad
  const exportToCSV = async () => {
    try {
      if (!apiKey || !clientId) {
        setError('No hay API key o client_id para exportar');
        return;
      }

      if (totalRecords === 0 || dontCallRecords.length === 0) {
        setError('No hay registros para exportar');
        return;
      }

      let maxToExport: number;

      if (exportMode === 'page') {
        maxToExport = dontCallRecords.length;
      } else if (exportMode === 'all') {
        maxToExport = totalRecords;
      } else {
        const parsed = parseInt(customExportCount.trim(), 10);
        if (isNaN(parsed) || parsed <= 0) {
          setError('Ingresa una cantidad válida de registros para exportar.');
          return;
        }
        maxToExport = Math.min(parsed, totalRecords);
      }

      setExporting(true);
      setError(null);

      // Si lo que pidió cabe en la página actual, no llamamos más a la API
      if (maxToExport <= dontCallRecords.length) {
        downloadDontCallCSV(dontCallRecords.slice(0, maxToExport), `${maxToExport}_registros`);
        setIsExportDialogOpen(false);
        return;
      }

      // Si necesita más que la página actual, ir paginando contra el backend
      const allRecords: DontCall[] = [];
      let page = 1;
      const perPage = 100; // máximo que permite el backend

      while (allRecords.length < maxToExport) {
        const params = buildDontCallParams(perPage, page);
        const response = await listDontCallRecords(apiKey, params);

        if (!response.registros || response.registros.length === 0) {
          break;
        }

        allRecords.push(...(response.registros as DontCall[]));

        if (page >= (response.total_paginas || 0)) {
          break;
        }

        page += 1;
      }

      const finalRecords = allRecords.slice(0, maxToExport);
      downloadDontCallCSV(finalRecords, `${finalRecords.length}_registros`);
      setIsExportDialogOpen(false);
    } catch (err) {
      // console.error('Error al exportar registros de No Llamar:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar registros');
    } finally {
      setExporting(false);
    }
  };

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };


  // Efectos
  useEffect(() => {
    if (apiKey && clientId) {
      loadDontCallRecords(1);
    }
  }, [apiKey, clientId]);

  useEffect(() => {
    // Recargar cuando cambien los filtros
    if (apiKey && clientId) {
      const timeoutId = setTimeout(() => {
        loadDontCallRecords(1);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, dateFrom, dateTo, apiKey, clientId]);

  // Si no tiene permisos, mostrar mensaje de acceso denegado
  if (!dontCallEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <PhoneOff className="h-12 w-12 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600 max-w-md">
            No tienes permisos para acceder a la página de No Llamar. 
            Contacta con tu administrador si crees que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            No Llamar
          </h1>
          <p className="text-muted-foreground">
            Registros de personas que no desean ser contactadas
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDontCallRecords(currentPage)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            onClick={() => setIsExportDialogOpen(true)}
            disabled={dontCallRecords.length === 0}
            size="sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Registros en la base de datos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros Recientes</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dontCallRecords.filter(r => {
                const recordDate = new Date(r.created_at);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return recordDate >= sevenDaysAgo;
              }).length.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 7 días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Página Actual</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPage} / {totalPages}
            </div>
            <p className="text-xs text-muted-foreground">
              {recordsPerPage} registros por página
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de exportación */}
      <Dialog open={isExportDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Resetear estado si se cierra sin exportar
          setIsExportDialogOpen(false);
          setExportMode('page');
          setCustomExportCount('');
        }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Exportar registros de No Llamar</DialogTitle>
            <DialogDescription>
              Elige cuántos registros quieres exportar aplicando los filtros actuales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Registros totales (con filtros): <span className="font-semibold">{totalRecords.toLocaleString()}</span>
              </p>
              <p className="text-xs text-slate-500">
                La exportación puede tardar más si seleccionas muchos registros.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={exportMode === 'page'}
                  onChange={() => setExportMode('page')}
                />
                <span>
                  Exportar solo la página actual ({dontCallRecords.length} registros)
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={exportMode === 'all'}
                  onChange={() => setExportMode('all')}
                />
                <span>
                  Exportar todos los registros filtrados ({totalRecords.toLocaleString()})
                </span>
              </label>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={exportMode === 'custom'}
                    onChange={() => setExportMode('custom')}
                  />
                  <span>Exportar una cantidad específica</span>
                </label>
                <div className="pl-7">
                  <Input
                    type="number"
                    min={1}
                    max={totalRecords || undefined}
                    placeholder="Ej: 200"
                    value={customExportCount}
                    onChange={(e) => setCustomExportCount(e.target.value)}
                    disabled={exportMode !== 'custom'}
                    className="bg-white border border-slate-300 text-slate-700"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Máximo: {totalRecords.toLocaleString()} registros.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsExportDialogOpen(false);
                setExportMode('page');
                setCustomExportCount('');
              }}
              disabled={exporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={exportToCSV}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Confirmar exportación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filtros */}
      <Card className="bg-white border border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="flex items-center gap-2 text-gray-700">
            <Filter className="h-5 w-5 text-blue-600" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Teléfono o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-gray-300 text-gray-700 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>


            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border-gray-300 text-gray-700 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border-gray-300 text-gray-700 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de registros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5" />
            Registros de No Llamar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="flex items-center space-x-2">
                <RefreshCw className="animate-spin h-5 w-5 text-blue-600" />
                <span className="text-gray-600">Cargando registros...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => loadDontCallRecords(currentPage)}>
                Reintentar
              </Button>
            </div>
          ) : dontCallRecords.length === 0 ? (
            <div className="text-center py-12">
              <PhoneOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron registros</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-gray-600">ID</th>
                      <th className="text-left p-3 font-medium text-gray-600">Teléfono</th>
                      <th className="text-left p-3 font-medium text-gray-600">Nombre</th>
                      <th className="text-left p-3 font-medium text-gray-600">Campaña</th>
                      <th className="text-left p-3 font-medium text-gray-600">Región</th>
                      <th className="text-left p-3 font-medium text-gray-600">Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dontCallRecords.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-900">{record.id}</td>
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="font-mono">{record.phone_number}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          {record.name ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{record.name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Sin nombre</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {record.campaña || (
                            <span className="text-gray-400">Sin campaña</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {record.region || (
                            <span className="text-gray-400">Sin región</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {formatDate(record.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-600">
                    Mostrando {((currentPage - 1) * recordsPerPage) + 1} a{' '}
                    {Math.min(currentPage * recordsPerPage, totalRecords)} de{' '}
                    {totalRecords} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadDontCallRecords(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadDontCallRecords(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NoLlamar;
