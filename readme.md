# uMindsAI Dashboard - Architectural Overview & Roadmap

## 🚀 Vision General
**uMindsAI Dashboard** es una plataforma de control y análisis de última generación diseñada para la gestión integral de operaciones de IA conversacional basadas en **Retell AI**. 

Como arquitecto de software, la prioridad ha sido transformar un prototipo funcional en una solución robusta, escalable y resiliente, integrando servicios de autenticación de nivel empresarial (**Supabase**) con una capa de visualización analítica de alto rendimiento.

---

## 🏗️ Pilares Arquitectónicos

### 1. Núcleo Tecnológico (The Stack)
- **Engine**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/) para un desarrollo ultra-rápido y builds optimizados.
- **Language**: [TypeScript](https://www.typescriptlang.org/) garantizando seguridad de tipos en todo el ciclo de vida del dato.
- **Styles**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/) para una interfaz atómica y altamente responsiva.
- **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + RLS) proporcionando seguridad a nivel de fila y gestión de sesiones persistentes.
- **AI Sync**: Integración nativa con [Retell AI API](https://www.retellai.com/) para el procesamiento de llamadas en tiempo real.

### 2. Estructura de Servicios
El proyecto sigue un patrón de **Servicios Desacoplados**, donde la lógica de negocio se separa estrictamente de la capa de presentación:
- `src/services/api/`: Servicios especializados por dominio (agendas, telefonía, grabaciones).
- `src/context/`: Gestión de estado global (Calls, Auth) mediante el patrón Context & Provider de React.
- `src/lib/`: Utilidades core y clientes de terceros (Supabase, formatters).

---

## 💎 ¿Qué hay de nuevo? (Recent Evolution)

En el último ciclo de desarrollo ("Fase de Estabilización y Resiliencia"), se han implementado mejoras arquitectónicas críticas para garantizar el tiempo de actividad y la integridad de los datos:

### ✅ Estabilización de Módulos Críticos
- **Grabaciones (Recordings)**: Re-factorización completa para manejar estados vacíos y errores de API de forma elegante, integrando una visualización de métricas en tiempo real que no interfiere con la carga de datos.
- **Agendas & Occupancy**: Implementación de lógica avanzada para la liberación automática de cupos y normalización de slots, eliminando fugas de datos y errores de referencia circular.
- **Telefonía Multi-Workspace**: Soporte integrado para múltiples API Keys de Retell, permitiendo a grandes empresas gestionar diferentes sucursales o departamentos desde una única interfaz consolidada.

### 🛠️ Robustez y Calidad del Código
- **Inyección de Dependencias**: Corrección de importaciones críticas y restauración de utilidades auxiliares en la capa de servicios, eliminando fallos en tiempo de ejecución.
- **Optimización de Build**: Reducción de advertencias del compilador y limpieza selectiva de logs de desarrollo (`console.log`) para una consola de producción limpia y de mayor rendimiento.
- **Resiliencia de Datos**: Mejora en el manejo de hooks de React para evitar re-renders innecesarios durante la carga masiva de logs de llamadas.

---

## 📈 Funcionalidades Core

| Módulo | Descripción |
| :--- | :--- |
| **Dashboard Analítico** | Métricas de rendimiento, tasas de efectividad y gráficos de distribución horaria. |
| **Centro de Grabaciones** | Acceso instantáneo a logs de audio con filtros por duración y motivo de desconexión. |
| **Gestor de Agendas** | Control preciso de la disponibilidad de los agentes y límites de agendamiento. |
| **Telefonía IP** | Importación/eliminación de números y lanzamiento de llamadas manuales con variables dinámicas. |
| **Seguridad** | Autenticación robusta y control de acceso basado en perfiles de usuario. |

---

## 🛠️ Guía de Ejecución

### Desarrollo
1. Copiar `.env.example` a `.env` y configurar credenciales de Supabase.
2. `npm install`
3. `npm run dev`

### Producción (Docker)
```bash
docker build -t umindsai-dashboard .
docker run -p 80:80 umindsai-dashboard
```

---

## 🗺️ Roadmap de Arquitectura
1. [ ] **Unit Testing**: Introducción de Vitest para pruebas de servicios core.
2. [ ] **Caching Layer**: Implementación de un Service Worker para cacheo agresivo de assets estáticos.
3. [ ] **Sentry Integration**: Monitoreo proactivo de errores en producción.
4. [ ] **Multi-language**: Internacionalización completa (i18n).

---

> [!NOTE]
> Este Dashboard es una herramienta viva. Cada mejora en la capa de servicios busca no solo resolver el problema inmediato, sino fortalecer la base sobre la cual crecerá la IA de la empresa.

---
© 2024-2025 uMindsAI | Software Architecture Team
