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
    <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Llamadas Recientes</h3>
            <p className="text-sm text-gray-400 mt-1">Total: {calls.length} llamadas</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white mr-2"
                placeholder="Fecha inicial"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                placeholder="Fecha final"
              />
            </div>
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar llamada..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 ${
                Object.keys(filters).length > 0 ? 'text-purple-400 border-purple-400' : 'text-gray-400'
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