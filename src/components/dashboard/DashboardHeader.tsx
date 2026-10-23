import React from "react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface DashboardHeaderProps {
  loading: boolean;
  dashboardData: any;
  timePeriod: string;
  selectValue: string;
  hasFiltroSolar: boolean;
  databaseFilter: string;
  appliedDatabaseFilter: string;
  setDatabaseFilter: (val: string) => void;
  applyDatabaseFilter: () => void;
  clearDatabaseFilter: () => void;
  handleTimePeriodChange: (val: string) => void;
  isCustomDateDialogOpen: boolean;
  setIsCustomDateDialogOpen: (val: boolean) => void;
  tempStartDate: string;
  setTempStartDate: (val: string) => void;
  tempStartTime: string;
  setTempStartTime: (val: string) => void;
  tempEndDate: string;
  setTempEndDate: (val: string) => void;
  tempEndTime: string;
  setTempEndTime: (val: string) => void;
  handleCancelCustomDates: () => void;
  handleConfirmCustomDates: () => void;
  customStartDate: string;
  customEndDate: string;
  customStartTime: string;
  customEndTime: string;
}

export function DashboardHeader({
  loading,
  dashboardData,
  timePeriod,
  selectValue,
  hasFiltroSolar,
  databaseFilter,
  appliedDatabaseFilter,
  setDatabaseFilter,
  applyDatabaseFilter,
  clearDatabaseFilter,
  handleTimePeriodChange,
  isCustomDateDialogOpen,
  setIsCustomDateDialogOpen,
  tempStartDate,
  setTempStartDate,
  tempStartTime,
  setTempStartTime,
  tempEndDate,
  setTempEndDate,
  tempEndTime,
  setTempEndTime,
  handleCancelCustomDates,
  handleConfirmCustomDates,
  customStartDate,
  customEndDate,
  customStartTime,
  customEndTime,
}: DashboardHeaderProps) {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
          Dashboard
        </h2>
        <p className="text-slate-600">Análisis de llamadas con uMindsAI</p>
        {dashboardData && (
          <div
            className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              loading
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-green-100 text-green-800 border-green-200"
            }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin w-3 h-3 mr-2"
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
                Actualizando métricas...
              </>
            ) : (
              <>
                <svg
                  className="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Datos actualizados del servidor
              </>
            )}
          </div>
        )}
      </div>

      {/* Filtros de período */}
      {dashboardData && (
        <div className="mb-6 flex flex-wrap gap-4 items-center p-4 bg-slate-100 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <label
              htmlFor="timePeriod"
              className="text-sm font-medium text-slate-700"
            >
              Período:
            </label>
            <Select value={selectValue} onValueChange={handleTimePeriodChange}>
              <SelectTrigger className="w-48">
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
              <label
                htmlFor="databaseFilter"
                className="text-sm font-medium text-slate-700"
              >
                Base de datos:
              </label>
              <input
                type="text"
                id="databaseFilter"
                value={databaseFilter}
                onChange={(e) => setDatabaseFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
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
                  className="text-sm"
                >
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {timePeriod === "custom" && customStartDate && customEndDate && (
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
            {timePeriod === "all" && "Mostrando todos los datos disponibles"}
            {timePeriod === "today" && "Mostrando datos de hoy"}
            {timePeriod === "week" && "Mostrando datos de los últimos 7 días"}
            {timePeriod === "month" && "Mostrando datos del último mes"}
            {timePeriod === "custom" &&
              customStartDate &&
              customEndDate &&
              `Mostrando datos del ${customStartDate} ${customStartTime} al ${customEndDate} ${customEndTime}`}
            {timePeriod === "custom" &&
              (!customStartDate || !customEndDate) &&
              "Selecciona un rango de fechas personalizado"}
            {appliedDatabaseFilter &&
              ` | Filtrado por base de datos: ${appliedDatabaseFilter}`}
          </div>
        </div>
      )}

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
                <label
                  htmlFor="dialogStartDate"
                  className="text-sm font-medium text-slate-700"
                >
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
                <label
                  htmlFor="dialogStartTime"
                  className="text-sm font-medium text-slate-700"
                >
                  Hora de inicio:
                </label>
                <input
                  type="time"
                  id="dialogStartTime"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value || "00:00")}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="dialogEndDate"
                  className="text-sm font-medium text-slate-700"
                >
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
                <label
                  htmlFor="dialogEndTime"
                  className="text-sm font-medium text-slate-700"
                >
                  Hora de fin:
                </label>
                <input
                  type="time"
                  id="dialogEndTime"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value || "23:59")}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {tempStartDate && tempEndDate && tempStartDate > tempEndDate && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                La fecha de inicio no puede ser posterior a la fecha de fin
              </div>
            )}
            {tempStartDate &&
              tempEndDate &&
              tempStartDate === tempEndDate &&
              (() => {
                const startTimeParts = tempStartTime.split(":");
                const endTimeParts = tempEndTime.split(":");
                const startMinutes =
                  parseInt(startTimeParts[0] || "0", 10) * 60 +
                  parseInt(startTimeParts[1] || "0", 10);
                const endMinutes =
                  parseInt(endTimeParts[0] || "23", 10) * 60 +
                  parseInt(endTimeParts[1] || "59", 10);
                return startMinutes >= endMinutes;
              })() && (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  La hora de inicio es mayor o igual que la de fin. Se
                  considerará hasta el final del día siguiente.
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCustomDates}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCustomDates}
              disabled={
                !tempStartDate || !tempEndDate || tempStartDate > tempEndDate
              }
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
