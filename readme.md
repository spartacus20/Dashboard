# uMindsAI Dashboard

## Descripción
uMindsAI Dashboard es una aplicación web para gestionar y visualizar llamadas realizadas con Retell AI. La plataforma ofrece una interfaz intuitiva para monitorear estadísticas de llamadas, acceder a grabaciones y gestionar números de teléfono asociados a tus agentes de IA.

## Características principales

- **Dashboard analítico**: Visualiza métricas clave y estadísticas de tus llamadas
- **Grabaciones**: Accede a todas las grabaciones con opciones avanzadas de filtrado
- **Números de teléfono**: Gestiona los números telefónicos asociados a tus agentes
- **Realización de llamadas**: Inicia llamadas directamente desde la interfaz
- **Sistema de caché**: Optimiza el rendimiento mediante almacenamiento temporal
- **Interfaz responsive**: Adaptada para dispositivos móviles y de escritorio

## Requisitos

- Node.js (v14 o superior)
- API key de Retell AI

## Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/uMindsAI-Dashboard.git
cd uMindsAI-Dashboard
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## Configuración

La aplicación requiere una API key de Retell AI para funcionar. Esta clave se proporciona como parámetro en la URL:

```
http://localhost:5173/?apikey=TU_API_KEY_DE_RETELL
```

## Uso

### Dashboard
La página principal muestra estadísticas generales incluyendo:
- Total de llamadas
- Llamadas completadas/fallidas
- Duración promedio
- Gráficos de distribución de llamadas

### Grabaciones
Accede a todas las grabaciones con opciones de filtrado por:
- Duración de llamada
- Razón de desconexión
- Rango de fechas
- Búsqueda por texto

### Números de teléfono
Lista todos tus números telefónicos con información detallada:
- Número formateado
- Tipo de número
- Código de área
- Agentes asociados
- Fecha de última modificación

### Realización de llamadas
Para realizar una llamada desde la interfaz:
1. Ve a la sección "Números de teléfono"
2. Selecciona un número y haz clic en "Llamar"
3. Introduce el número de destino
4. Selecciona el agente para la llamada
5. Opcionalmente, añade variables dinámicas
6. Haz clic en "Iniciar llamada"

## Tecnologías utilizadas

- React
- TypeScript
- Tailwind CSS
- Lucide Icons
- Retell AI API

## Características avanzadas

- **Paginación eficiente**: Sistema para manejar grandes volúmenes de datos
- **Filtrado en tiempo real**: Experimenta filtrados sin recarga de página
- **Sistema de caché**: Almacenamiento temporal con expiración de 15 minutos
- **Indicadores visuales**: Retroalimentación clara durante operaciones
- **Gestión de errores**: Mensajes informativos para facilitar la solución de problemas

## Licencia
Este proyecto está bajo la licencia MIT.
# Dashboard
