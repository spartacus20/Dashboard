# uMindsAI Dashboard

## Descripción
uMindsAI Dashboard es una aplicación web para gestionar y visualizar llamadas realizadas con Retell AI. La plataforma ofrece una interfaz intuitiva para monitorear estadísticas de llamadas, acceder a grabaciones y gestionar números de teléfono asociados a tus agentes de IA.

## Características principales

- **Acceso directo**: Sistema basado en client_id como parámetro de URL
- **Dashboard analítico**: Visualiza métricas clave y estadísticas de tus llamadas
- **Grabaciones**: Accede a todas las grabaciones con opciones avanzadas de filtrado
- **Números de teléfono**: Gestiona los números telefónicos asociados a tus agentes
- **Realización de llamadas**: Inicia llamadas directamente desde la interfaz
- **Sistema de caché**: Optimiza el rendimiento mediante almacenamiento temporal
- **Interfaz responsive**: Adaptada para dispositivos móviles y de escritorio

## Requisitos

- Node.js (v14 o superior)
- Client ID válido para acceder al dashboard

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

### Acceso con Client ID o API Key
La aplicación requiere un `client_id` o `api_key` como parámetro en la URL para acceder:

**Opción 1 - Solo client_id (recomendado):**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID
```

**Opción 2 - Solo api_key:**
```
http://localhost:5173/dashboard?api_key=TU_API_KEY
```

**Opción 3 - Ambos parámetros:**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&api_key=TU_API_KEY
```

**Opción 4 - Con control de agenda:**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&agenda=false
```

**Opción 5 - Con control de llamadas:**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&calls=false
```

**Opción 6 - Combinación de controles:**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&agenda=false&calls=false
```

**Opción 7 - Filtrar por número específico:**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&phone=+1234567890
```

**Opción 8 - Combinación completa:**
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&phone=+1234567890&agenda=false&calls=false
```

- **client_id**: Se utiliza para obtener automáticamente la API key de Retell AI asociada a tu cuenta
- **api_key**: Se utiliza directamente sin necesidad de consultar al servidor
- **agenda**: Controla la visibilidad de las funcionalidades de agenda (true/false, por defecto true)
- **calls**: Controla la visibilidad de los botones de hacer llamadas (true/false, por defecto true)
- **phone**: Filtra para mostrar solo un número de teléfono específico (con o sin +)

## Uso

### Dashboard
La página principal muestra estadísticas generales incluyendo:
- Total de llamadas
- Llamadas efectivas/fallidas
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
- **Añadir nuevos números de teléfono** con configuración completa
- **Eliminar números de teléfono** con confirmación de seguridad

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
- React Router DOM

## Características avanzadas

- **Paginación eficiente**: Sistema para manejar grandes volúmenes de datos
- **Filtrado en tiempo real**: Experimenta filtrados sin recarga de página
- **Sistema de caché**: Almacenamiento temporal con expiración de 15 minutos
- **Indicadores visuales**: Retroalimentación clara durante operaciones
- **Gestión de errores**: Mensajes informativos para facilitar la solución de problemas

## Documentación Adicional

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Guía completa del sistema de autenticación con Supabase
- **[INFRAESTRUCTURA.md](./INFRAESTRUCTURA.md)** - Documentación detallada de la infraestructura y arquitectura del proyecto

## Licencia
Este proyecto está bajo la licencia MIT.
