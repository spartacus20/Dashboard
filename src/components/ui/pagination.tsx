import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

// Componente contenedor principal
export const Pagination = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center justify-center", className)} {...props}>
    {children}
  </div>
);

// Contenido de la paginación
export const PaginationContent = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

// Item individual de paginación
export const PaginationItem = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("", className)} {...props}>
    {children}
  </div>
);

// Propiedades para el link de paginación
interface PaginationLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

// Link de paginación
export const PaginationLink = ({
  className,
  isActive,
  children,
  ...props
}: PaginationLinkProps) => (
  <button
    className={cn(
      "inline-flex items-center justify-center text-sm font-medium h-9 min-w-9 px-2 rounded-md",
      isActive
        ? "bg-purple-600 text-white"
        : "text-gray-400 hover:text-white hover:bg-gray-800",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

// Botón de anterior
export const PaginationPrevious = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "inline-flex items-center justify-center h-9 px-2 text-sm rounded-md text-gray-400 hover:text-white hover:bg-gray-800",
      className
    )}
    {...props}
  >
    <ChevronLeft className="h-4 w-4 mr-1" />
    <span>Anterior</span>
  </button>
);

// Botón de siguiente
export const PaginationNext = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "inline-flex items-center justify-center h-9 px-2 text-sm rounded-md text-gray-400 hover:text-white hover:bg-gray-800",
      className
    )}
    {...props}
  >
    <span>Siguiente</span>
    <ChevronRight className="h-4 w-4 ml-1" />
  </button>
); 