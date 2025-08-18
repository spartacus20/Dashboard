# 📞 Ejemplos Prácticos del Endpoint List Calls

## 🎯 Descripción
Este documento contiene ejemplos prácticos de cómo usar las funciones `listCalls` y `fetchAllCallsWithListCalls` que implementan el endpoint `/api/calls/list-calls` con la `BASE_URL`.

## 🔧 Funciones Disponibles

### 1. `listCalls(apiKey, params)`
Obtiene llamadas con filtros específicos y paginación.

### 2. `fetchAllCallsWithListCalls(apiKey, params)`
Obtiene TODAS las llamadas con paginación automática.

## 📋 Parámetros Disponibles

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `client_id` | string | ID del cliente | "mas_sol001" |
| `from_number` | string | Número de origen | "+34612345678" |
| `to_number` | string | Número de destino | "+34687654321" |
| `status` | string | Estado de la llamada | "efectiva" o "fallida" |
| `fecha_inicio` | string | Fecha de inicio | "2024-01-01" |
| `fecha_fin` | string | Fecha de fin | "2024-12-31" |
| `sort_order` | string | Orden de resultados | "ASC" o "DESC" |
| `page` | number | Número de página | 1 |
| `per_page` | number | Registros por página | 50 (máx 100) |

## 🚀 Ejemplos Prácticos

### 1. Obtener todas las llamadas de un cliente
```javascript
import { listCalls } from './api';

const calls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  sort_order: "ASC"
});

console.log(`Total de llamadas: ${calls.total_calls}`);
console.log(`Página actual: ${calls.current_page} de ${calls.total_pages}`);
```

**Resultado:** Todas las llamadas del cliente mas_sol001, ordenadas por fecha (más antiguas primero).

### 2. Llamadas efectivas de un período específico
```javascript
const effectiveCalls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "efectiva",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC",
  page: 1,
  per_page: 100
});
```

**Resultado:** Solo llamadas exitosas de diciembre 2024, ordenadas por fecha (más recientes primero).

### 3. Buscar llamadas de un número específico
```javascript
const numberCalls = await listCalls(apiKey, {
  from_number: "+34612345678",
  sort_order: "ASC"
});
```

**Resultado:** Todas las llamadas realizadas desde ese número, sin importar el cliente.

### 4. Llamadas fallidas de un cliente
```javascript
const failedCalls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "fallida",
  per_page: 25,
  sort_order: "DESC"
});
```

**Resultado:** Máximo 25 llamadas fallidas del cliente, para análisis de problemas.

### 5. Análisis de llamadas por rango de fechas
```javascript
const dateRangeCalls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  fecha_inicio: "2024-01-01",
  fecha_fin: "2024-01-31",
  sort_order: "ASC"
});
```

**Resultado:** Todas las llamadas de enero 2024, ordenadas cronológicamente.

### 6. Búsqueda avanzada combinando filtros
```javascript
const advancedSearch = await listCalls(apiKey, {
  client_id: "mas_sol001",
  from_number: "+34612345678",
  to_number: "+34687654321",
  status: "efectiva",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-15",
  sort_order: "DESC"
});
```

**Resultado:** Llamadas exitosas entre dos números específicos en la primera quincena de diciembre.

## 🎯 Casos de Uso Comunes

### Para Reportes de Ventas
```javascript
const salesReport = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "efectiva",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC"
});

const totalSales = salesReport.calls.length;
const totalPages = salesReport.total_pages;
console.log(`Reporte de ventas: ${totalSales} llamadas efectivas en ${totalPages} páginas`);
```

### Para Análisis de Problemas
```javascript
const problemAnalysis = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "fallida",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC",
  per_page: 50
});

console.log(`Análisis de problemas: ${problemAnalysis.calls.length} llamadas fallidas`);
```

### Para Auditoría de Números
```javascript
const numberAudit = await listCalls(apiKey, {
  from_number: "+34612345678",
  sort_order: "ASC"
});

console.log(`Auditoría del número: ${numberAudit.calls.length} llamadas realizadas`);
```

### Para Dashboard en Tiempo Real
```javascript
const realTimeData = await listCalls(apiKey, {
  client_id: "mas_sol001",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC",
  page: 1,
  per_page: 100
});

const effectiveCalls = realTimeData.calls.filter(call => call.status === 'completed');
const failedCalls = realTimeData.calls.filter(call => call.status === 'failed');

console.log(`Dashboard: ${effectiveCalls.length} efectivas, ${failedCalls.length} fallidas`);
```

## 🔄 Obtener TODAS las Llamadas (Paginación Automática)

### Ejemplo con `fetchAllCallsWithListCalls`
```javascript
import { fetchAllCallsWithListCalls } from './api';

// Obtener todas las llamadas de un cliente (automáticamente maneja la paginación)
const allCalls = await fetchAllCallsWithListCalls(apiKey, {
  client_id: "mas_sol001",
  status: "efectiva",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC"
});

console.log(`Total de llamadas obtenidas: ${allCalls.length}`);

// Procesar todas las llamadas
allCalls.forEach(call => {
  console.log(`Llamada ${call.call_id}: ${call.duration}s - ${call.status}`);
});
```

## 📊 Estructura de Respuesta

```javascript
{
  calls: [
    {
      call_id: "call_123",
      duration: 120,
      start_time: "2024-12-01T10:00:00Z",
      start_timestamp: 1701432000000,
      end_timestamp: 1701432120000,
      disconnection_reason: "completed",
      status: "completed",
      call_status: "completed",
      transcript: "...",
      recording_url: "https://...",
      to_number: "+34687654321",
      from_number: "+34612345678",
      metadata: {
        id: "123",
        client_id: "mas_sol001",
        summary: "...",
        interest: "high",
        tipo_vivienda: "casa",
        created_at: "2024-12-01T10:00:00Z",
        end_reason: "completed"
      }
    }
  ],
  total_pages: 5,
  total_calls: 450,
  current_page: 1
}
```

## 💡 Tips de Uso

### Paginación
- Usa `per_page` para controlar la cantidad de resultados
- El máximo es 100 registros por página
- Usa `page` para navegar entre páginas

### Orden
- `ASC`: Para análisis cronológico (más antiguas primero)
- `DESC`: Para ver lo más reciente primero

### Fechas
- Si solo envías fecha (YYYY-MM-DD), se interpreta como todo el día
- Usa formato ISO para mayor precisión

### Combinaciones
- Puedes combinar todos los filtros según necesites
- Los filtros son opcionales, puedes usar solo los que necesites

### Performance
- Usa filtros específicos para consultas más rápidas
- Para grandes volúmenes, usa `fetchAllCallsWithListCalls` con paginación automática

## 🔍 Ejemplos de JavaScript/Fetch

### Ejemplo básico con fetch
```javascript
const url = `${BASE_URL}/api/calls/list-calls`;

const params = {
  client_id: 'mas_sol001',
  status: 'efectiva',
  sort_order: 'DESC'
};

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(params),
});

const data = await response.json();
console.log(data);
```

¡Con estos ejemplos puedes aprovechar al máximo todas las funcionalidades del endpoint list-calls! 🚀
