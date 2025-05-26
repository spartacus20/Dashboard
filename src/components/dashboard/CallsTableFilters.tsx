import React from 'react';
import type { FilterCriteria, RetellCall } from '../../types';

interface CallsTableFiltersProps {
  filters: FilterCriteria;
  onFilterChange: (key: keyof FilterCriteria, value: any) => void;
  onClearFilters: () => void;
}

export function CallsTableFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: CallsTableFiltersProps) {
  return (
    <div className="p-4 border-t border-gray-800 bg-gray-900/50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Estado</label>
          <select
            multiple
            value={filters.call_status || []}
            onChange={(e) => onFilterChange('call_status', 
              Array.from(e.target.selectedOptions, option => option.value as RetellCall['call_status'])
            )}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
          >
            <option value="registered">Registrada</option>
            <option value="ongoing">En Curso</option>
            <option value="ended">Completada</option>
            <option value="error">Fallida</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Llamada</label>
          <select
            multiple
            value={filters.call_type || []}
            onChange={(e) => onFilterChange('call_type',
              Array.from(e.target.selectedOptions, option => option.value)
            )}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
          >
            <option value="web_call">Web</option>
            <option value="phone_call">Teléfono</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Dirección</label>
          <select
            multiple
            value={filters.direction || []}
            onChange={(e) => onFilterChange('direction',
              Array.from(e.target.selectedOptions, option => option.value)
            )}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
          >
            <option value="inbound">Entrante</option>
            <option value="outbound">Saliente</option>
          </select>
        </div>
      </div>
      {Object.keys(filters).length > 0 && (
        <button
          onClick={onClearFilters}
          className="mt-4 px-4 py-2 text-sm text-red-400 hover:text-red-300"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}