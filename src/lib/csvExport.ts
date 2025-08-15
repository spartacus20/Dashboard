import { Agenda } from '../types';

// Función para escapar valores CSV
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Función para formatear fecha
function formatDateForCSV(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

// Función para exportar agendas a CSV
export function exportAgendasToCSV(agendas: Agenda[], filename?: string): void {
  // Definir las columnas del CSV
  const headers = [
    'ID',
    'Nombre',
    'Teléfono',
    'Dirección',
    'Local',
    'Ciudad',
    'Región',
    'Código Postal',
    'Tipo de Agenda',
    'Fecha de Agendamiento',
    'Fecha de Creación',
    'Call ID',
    'Client ID'
  ];

  // Crear las filas de datos
  const rows = agendas.map(agenda => [
    agenda.id,
    escapeCSVValue(agenda.nombre || ''),
    agenda.phone_number || '',
    escapeCSVValue(agenda.direccion || ''),
    escapeCSVValue(agenda.local || ''),
    escapeCSVValue(agenda.ciudad || ''),
    escapeCSVValue(agenda.region || ''),
    agenda.codigo_postal || '',
    escapeCSVValue(agenda.tipo_agenda || ''),
    agenda.fecha_agendamiento ? formatDateForCSV(agenda.fecha_agendamiento) : '',
    agenda.created_at ? formatDateForCSV(agenda.created_at) : '',
    agenda.call_id || '',
    agenda.client_id || ''
  ]);

  // Crear el contenido CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Crear el blob y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename || `agendas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Función para generar nombre de archivo con filtros
export function generateCSVFilename(
  totalAgendas: number,
  searchTerm?: string,
  filterType?: string,
  dateFrom?: string,
  dateTo?: string
): string {
  const date = new Date().toISOString().split('T')[0];
  let filename = `agendas_${totalAgendas}_registros_${date}`;
  
  if (searchTerm) {
    filename += `_busqueda_${searchTerm.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  
  if (filterType && filterType !== 'all') {
    filename += `_tipo_${filterType.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  
  if (dateFrom || dateTo) {
    const fromDate = dateFrom ? dateFrom.replace(/-/g, '') : 'inicio';
    const toDate = dateTo ? dateTo.replace(/-/g, '') : 'fin';
    filename += `_fechas_${fromDate}_${toDate}`;
  }
  
  return `${filename}.csv`;
} 