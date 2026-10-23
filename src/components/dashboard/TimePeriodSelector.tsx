import React from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export interface TimePeriodSelectorProps {
  timePeriod: string;
  selectValue: string;
  handleTimePeriodChange: (newPeriod: string) => void;
  hasFiltroSolar: boolean;
  databaseFilter: string;
  setDatabaseFilter: (v: string) => void;
  applyDatabaseFilter: () => void;
  appliedDatabaseFilter: string;
  clearDatabaseFilter: () => void;
  customStartDate: string;
  customEndDate: string;
  customStartTime: string;
  customEndTime: string;
  isCustomDateDialogOpen: boolean;
  setIsCustomDateDialogOpen: (v: boolean) => void;
  tempStartDate: string;
  setTempStartDate: (v: string) => void;
  tempEndDate: string;
  setTempEndDate: (v: string) => void;
  tempStartTime: string;
  setTempStartTime: (v: string) => void;
  tempEndTime: string;
  setTempEndTime: (v: string) => void;
  handleConfirmCustomDates: () => void;
  handleCancelCustomDates: () => void;
}

export function TimePeriodSelector({
  timePeriod,
  selectValue,
  handleTimePeriodChange,
  hasFiltroSolar,
  databaseFilter,
  setDatabaseFilter,
  applyDatabaseFilter,
  appliedDatabaseFilter,
  clearDatabaseFilter,
  customStartDate,
  customEndDate,
  customStartTime,
  customEndTime,
  isCustomDateDialogOpen,
  setIsCustomDateDialogOpen,
  tempStartDate,
  setTempStartDate,
  tempEndDate,
  setTempEndDate,
  tempStartTime,
  setTempStartTime,
  tempEndTime,
  setTempEndTime,
  handleConfirmCustomDates,
  handleCancelCustomDates,
}: TimePeriodSelectorProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-4 items-center p-4 bg-slate-100 rounded-lg border border-slate-200">
      <div className="flex items-center gap-2">
        <label htmlFor="timePeriod" className="text-sm font-medium text-slate-700">
          Período:
        </label>
        <Select value={selectValue} onValueChange={handleTimePeriodChange}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los datos</SelectItem>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mes</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFiltroSolar && (
        <div className="flex items-center gap-2">
          <label htmlFor="databaseFilter" className="text-sm font-medium text-slate-700">
            Base de datos:
          </label>
          <input
            type="text"
            id="databaseFilter"
            value={databaseFilter}
            onChange={(e) => setDatabaseFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyDatabaseFilter();
              }
            }}
            placeholder="Nombre de la base de datos"
            className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          <Button
            onClick={applyDatabaseFilter}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!databaseFilter.trim()}
          >
            Filtrar
          </Button>
          {appliedDatabaseFilter && (
            <Button
              onClick={clearDatabaseFilter}
              variant="outline"
              className="text-sm bg-white"
            >
              Limpiar
            </Button>
          )}
        </div>
      )}

      {timePeriod === 'custom' && customStartDate && customEndDate && (
        <Button
          onClick={() => {
            setTempStartDate(customStartDate);
            setTempEndDate(customEndDate);
            setTempStartTime(customStartTime);
            setTempEndTime(customEndTime);
            setIsCustomDateDialogOpen(true);
          }}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
        >
          Seleccionar rango de fechas y horas
        </Button>
      )}

      <div className="text-xs text-slate-600">
        {timePeriod === 'all' && 'Mostrando todos los datos disponibles'}
        {timePeriod === 'today' && 'Mostrando datos de hoy'}
        {timePeriod === 'week' && 'Mostrando datos de los últimos 7 días'}
        {timePeriod === 'month' && 'Mostrando datos del último mes'}
        {timePeriod === 'custom' &&
          customStartDate &&
          customEndDate &&
          `Mostrando datos del ${customStartDate} ${customStartTime} al ${customEndDate} ${customEndTime}`}
        {timePeriod === 'custom' &&
          (!customStartDate || !customEndDate) &&
          'Selecciona un rango de fechas personalizado'}
        {appliedDatabaseFilter && ` | Filtrado por base de datos: ${appliedDatabaseFilter}`}
      </div>

      {/* Dialog para seleccionar fechas personalizadas */}
      <Dialog
        open={isCustomDateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelCustomDates();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Seleccionar Rango de Fechas Personalizado</DialogTitle>
            <DialogDescription>
              Elige el rango de fechas para filtrar los datos del dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="dialogStartDate" className="text-sm font-medium text-slate-700">
                  Fecha de inicio:
                </label>
                <input
                  type="date"
                  id="dialogStartDate"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="dialogStartTime" className="text-sm font-medium text-slate-700">
                  Hora de inicio:
                </label>
                <input
                  type="time"
                  id="dialogStartTime"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value || '00:00')}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="dialogEndDate" className="text-sm font-medium text-slate-700">
                  Fecha de fin:
                </label>
                <input
                  type="date"
                  id="dialogEndDate"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate || undefined}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="dialogEndTime" className="text-sm font-medium text-slate-700">
                  Hora de fin:
                </label>
                <input
                  type="time"
                  id="dialogEndTime"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value || '23:59')}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCustomDates}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCustomDates}
              disabled={!tempStartDate || !tempEndDate || tempStartDate > tempEndDate}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
