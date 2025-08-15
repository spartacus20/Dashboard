import React from 'react';
import { Search, Filter } from 'lucide-react';
import type { RetellCall, FilterCriteria } from '../../types';
import { CallsTableFilters } from './CallsTableFilters';
import { CallsTableContent } from './CallsTableContent';

interface CallsTableProps {
  calls: RetellCall[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filters: FilterCriteria;
  onFilterChange: (key: keyof FilterCriteria, value: any) => void;
  onClearFilters: () => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  paginationKey?: string;
  onLoadMore: () => void;
}

export function CallsTable({
  calls,
  loading,
  error,
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paginationKey,
  onLoadMore,
}: CallsTableProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl shadow-lg border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-gray-800">Llamadas Recientes</h3>
            <p className="text-sm text-slate-600 mt-1">Total: {calls.length} llamadas</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 mr-2"
                placeholder="Fecha inicial"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                placeholder="Fecha final"
              />
            </div>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar llamada..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder-slate-400"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-100 transition-colors ${
                Object.keys(filters).length > 0 ? 'text-blue-600 border-blue-400 bg-blue-50' : 'text-slate-600 border-slate-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
            </button>
          </div>
        </div>

        {showFilters && (
          <CallsTableFilters
            filters={filters}
            onFilterChange={onFilterChange}
            onClearFilters={onClearFilters}
          />
        )}
      </div>

      <CallsTableContent
        calls={calls}
        loading={loading}
        error={error}
        paginationKey={paginationKey}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}