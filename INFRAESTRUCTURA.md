# Infraestructura del Dashboard uMindsAI

## Arquitectura General

El Dashboard uMindsAI es una aplicación web moderna construida con React, TypeScript y Vite, que proporciona una interfaz para gestionar y visualizar llamadas realizadas con Retell AI. La aplicación utiliza una arquitectura de frontend SPA (Single Page Application) con autenticación basada en Supabase.

## Stack Tecnológico

### Frontend
- **React 18.3.1** - Biblioteca de UI
- **TypeScript 5.5.3** - Tipado estático
- **Vite 5.4.2** - Herramienta de build y desarrollo
- **Tailwind CSS 3.4.1** - Framework de CSS
- **React Router DOM 7.6.1** - Enrutamiento del lado del cliente

### UI Components
- **Radix UI** - Componentes accesibles y sin estilos
- **Lucide React** - Iconografía
- **Chart.js & React-ChartJS-2** - Gráficos y visualizaciones
- **Recharts** - Gráficos adicionales

### Backend y Servicios
- **Supabase** - Backend-as-a-Service para autenticación y base de datos
- **Retell AI API** - API para gestión de llamadas
- **Get-Client API** - Servicio para obtención de client_id

### Infraestructura de Despliegue
- **Docker** - Containerización
- **Nginx** - Servidor web y proxy reverso
- **Node.js 22.13.1+** - Entorno de ejecución

## Estructura del Proyecto

```
Dashboard/
├── src/
│   ├── components/           # Componentes reutilizables
│   │   ├── dashboard/        # Componentes específicos del dashboard
│   │   ├── layout/           # Componentes de layout
│   │   └── ui/               # Componentes base de UI
│   ├── context/              # Contextos de React
│   │   ├── AuthContext.tsx   # Gestión de autenticación
│   │   └── CallsContext.tsx  # Gestión de llamadas
│   ├── lib/                  # Utilidades y configuraciones
│   │   ├── supabase.ts       # Configuración de Supabase
│   │   ├── cors.ts           # Configuración CORS
│   │   └── utils.ts          # Utilidades generales
│   ├── pages/                # Páginas de la aplicación
│   ├── types.ts              # Definiciones de tipos TypeScript
│   └── main.tsx              # Punto de entrada
├── public/                   # Archivos estáticos
├── dist/                     # Build de producción
├── Dockerfile                # Configuración de Docker
├── nginx.conf                # Configuración de Nginx
└── package.json              # Dependencias y scripts
```

## Changelog

### [v2.1.0] - 2025-03-11 - Fase de Estabilización y Resiliencia

#### 🔧 Mejoras Arquitectónicas
- **Depuración Core de Servicios**: Restauración de funciones auxiliares críticas en `agendas.ts` y corrección de imports en `telephony.ts`.
- **Resiliencia de Módulos**: Estabilización de los módulos de Grabaciones, Agendas y Números de Teléfono tras una fase de refactorización.
- **Optimización de Logs**: Implementación de limpieza selectiva de `console.log` para mejorar el rendimiento en producción sin perder trazabilidad en desarrollo.
- **Soporte Multi-Workspace**: Mejora en la lógica de resolución de nombres de workspace para configuraciones con múltiples API Keys de Retell.

#### ✅ Verificación
- Validación completa del ciclo de build (`npm run build`).
- Corrección de advertencias de linter y dependencias circulares.

### [v2.0.0] - 2024-12-19 - Implementación de Sistema de Autenticación

#### ✨ Nuevas Características
- **Sistema de Autenticación Completo con Supabase**
  - Login con email/contraseña
  - Autenticación OAuth (Google, GitHub)
  - Registro de nuevos usuarios
  - Restablecimiento de contraseña
  - Gestión de sesiones con tokens JWT

- **Protección de Rutas**
  - Componente `ProtectedRoute` para rutas sensibles
  - Redirección automática al login
  - Verificación de autenticación en tiempo real

- **Integración con Get-Client API**
  - Obtención automática de `client_id` al hacer login
  - Endpoint: `https://api.iacreatorhub.com/get-client`
  - Almacenamiento seguro en localStorage
  - Fallback a configuración manual

#### 🔧 Mejoras
- **Contexto de Autenticación Global**
  - `AuthContext` para gestión de estado de usuario
  - Hook `useAuth` para acceso fácil desde componentes
  - Limpieza automática de datos al cerrar sesión

- **Configuración de Desarrollo**
  - Headers CORS configurados en Vite
  - Proxy para API local (`/api` → `localhost:3000`)
  - Optimización de dependencias

#### 📁 Archivos Nuevos
- `src/context/AuthContext.tsx` - Contexto de autenticación
- `src/components/Login.tsx` - Componente de login
- `src/components/ProtectedRoute.tsx` - Protección de rutas
- `src/lib/supabase.ts` - Configuración de Supabase
- `AUTHENTICATION.md` - Documentación del sistema de auth

#### 🔄 Archivos Modificados
- `src/AppRouter.tsx` - Integración de rutas protegidas
- `src/DashboardApp.tsx` - Wrapper con AuthProvider
- `src/main.tsx` - Configuración inicial de autenticación
- `vite.config.ts` - Headers CORS y proxy

---

### [v1.5.0] - 2024-12-18 - Mejoras en Componentes del Dashboard

#### ✨ Nuevas Características
- **Sistema de Agendas**
  - `AgendaCalendar.tsx` - Calendario interactivo
  - `AgendaModal.tsx` - Modal para crear/editar agendas
  - `DayAgendasModal.tsx` - Modal para agendas diarias

- **Tabla de Llamadas Mejorada**
  - `CallsTable.tsx` - Tabla principal con paginación
  - `CallsTableContent.tsx` - Contenido de la tabla
  - `CallsTableFilters.tsx` - Filtros avanzados

- **Gráficos y Visualizaciones**
  - `HourlyCallsChart.tsx` - Gráfico de llamadas por hora
  - `PeakTimesChart.tsx` - Gráfico de horas pico
  - `StatsGrid.tsx` - Grid de estadísticas

#### 🔧 Mejoras
- **Arquitectura de Componentes**
  - Separación de responsabilidades
  - Componentes reutilizables
  - Mejor organización del código

---

### [v1.4.0] - 2024-12-17 - Configuración de Despliegue

#### ✨ Nuevas Características
- **Containerización con Docker**
  - `Dockerfile` optimizado para producción
  - Imagen base Nginx estable
  - Configuración de puertos y volúmenes

- **Configuración de Nginx**
  - `nginx.conf` para SPA
  - Soporte para rutas del lado del cliente
  - Cacheo optimizado para archivos estáticos

#### 🔧 Mejoras
- **Build de Producción**
  - Optimización de assets
  - Configuración de rollup
  - Copia de archivos públicos

---

### [v1.3.0] - 2024-12-16 - Mejoras en la API

#### 🔧 Mejoras
- **Gestión de Llamadas**
  - Contexto `CallsContext` para estado global
  - Mejores manejadores de errores
  - Optimización de peticiones HTTP

- **Utilidades**
  - Funciones de exportación CSV
  - Utilidades de formateo
  - Helpers para fechas y números

---

### [v1.2.0] - 2024-12-15 - Estructura de Páginas

#### ✨ Nuevas Características
- **Páginas Principales**
  - `Dashboard.tsx` - Página principal
  - `Agendas.tsx` - Gestión de agendas
  - `Callbacks.tsx` - Gestión de callbacks
  - `PhoneNumbers.tsx` - Gestión de números
  - `Recordings.tsx` - Grabaciones

#### 🔧 Mejoras
- **Layout y Navegación**
  - `DashboardLayout.tsx` - Layout principal
  - `Sidebar.tsx` - Navegación lateral
  - Componentes de UI base

---

### [v1.1.0] - 2024-12-14 - Configuración Inicial

#### ✨ Nuevas Características
- **Configuración Base**
  - React + TypeScript + Vite
  - Tailwind CSS para estilos
  - React Router para navegación
  - Radix UI para componentes

#### 📁 Archivos Base
- `package.json` - Dependencias y scripts
- `vite.config.ts` - Configuración de Vite
- `tailwind.config.js` - Configuración de Tailwind
- `tsconfig.json` - Configuración de TypeScript

---

### [v1.0.0] - 2024-12-13 - Versión Inicial

#### ✨ Características Iniciales
- **Acceso por Parámetros URL**
  - Acceso con `client_id` o `api_key`
  - Parámetros de control (`agenda`, `calls`, `phone`)
  - Sin autenticación de usuarios

- **Funcionalidades Básicas**
  - Dashboard con estadísticas
  - Lista de grabaciones
  - Gestión de números de teléfono
  - Realización de llamadas

#### 🔧 Limitaciones Iniciales
- Sin autenticación de usuarios
- Acceso basado únicamente en parámetros URL
- Sin validación de credenciales
- Datos almacenados sin validación

## Flujo de Autenticación

1. **Acceso inicial**: Usuario accede a cualquier ruta protegida
2. **Verificación**: `ProtectedRoute` verifica si hay sesión activa
3. **Redirección**: Si no está autenticado, redirige a `/login`
4. **Login**: Usuario se autentica (email/password o OAuth)
5. **Obtención de Client ID**: Automáticamente se obtiene el `client_id` de Get-Client
6. **Almacenamiento**: Client ID se guarda en localStorage
7. **Acceso al Dashboard**: Usuario accede a las funcionalidades protegidas

## Variables de Entorno Requeridas

```env
# Supabase
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima

# Get-Client API
VITE_GET_CLIENT_API_URL=https://api.get-client.com
VITE_GET_CLIENT_CLIENT_ID=tu_client_id
```

## Scripts de Desarrollo

```json
{
  "dev": "vite",                    // Servidor de desarrollo
  "build": "vite build",           // Build de producción
  "preview": "vite preview",       // Preview del build
  "lint": "eslint ."               // Linting del código
}
```

## Despliegue

### Desarrollo Local
```bash
npm install
npm run dev
```

### Producción con Docker
```bash
npm run build
docker build -t dashboard-umindsai .
docker run -p 80:80 dashboard-umindsai
```

## Seguridad Implementada

1. **Autenticación JWT**: Tokens seguros manejados por Supabase
2. **Row Level Security (RLS)**: Políticas de seguridad a nivel de base de datos
3. **Protección de Rutas**: Todas las rutas sensibles están protegidas
4. **Gestión de Sesiones**: Limpieza automática de datos sensibles
5. **CORS Configurado**: Headers de seguridad apropiados

## Monitoreo y Logs

- **Console Logs**: Para desarrollo y debugging
- **Error Handling**: Gestión de errores en todas las operaciones críticas
- **Loading States**: Indicadores de carga para mejor UX
- **Toast Notifications**: Feedback visual para el usuario

## Próximos Pasos Recomendados

1. **Implementar tests unitarios** con Jest/Vitest
2. **Configurar CI/CD** con GitHub Actions
3. **Implementar monitoreo** con herramientas como Sentry
4. **Optimizar bundle size** con análisis de dependencias
5. **Implementar PWA** para funcionalidad offline
6. **Añadir internacionalización** (i18n) para múltiples idiomas

## Troubleshooting Común

### Error de autenticación
- Verificar configuración de Supabase
- Comprobar variables de entorno
- Revisar políticas RLS en la base de datos

### Error de Get-Client API
- Verificar conectividad a `api.iacreatorhub.com`
- Comprobar formato del email
- Revisar logs de la consola

### Problemas de build
- Limpiar `node_modules` y reinstalar
- Verificar versión de Node.js (>=22.13.1)
- Comprobar configuración de TypeScript

---

*Documento actualizado: $(date)*
*Versión del proyecto: 0.0.0*
