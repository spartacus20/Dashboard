# Guía de Uso - uMindsAI Dashboard

## Acceso a la Aplicación

La aplicación ahora utiliza un sistema de acceso basado en `client_id` o `api_key` como parámetros de URL. Ya no es necesario un sistema de login.

### URLs de Acceso

Para acceder al dashboard, puedes usar cualquiera de estas opciones:

#### Opción 1 - Solo client_id (Recomendado)
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID
```

#### Opción 2 - Solo api_key
```
http://localhost:5173/dashboard?api_key=TU_API_KEY
```

#### Opción 3 - Ambos parámetros
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&api_key=TU_API_KEY
```

#### Opción 4 - Con control de agenda
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&agenda=false
```

#### Opción 5 - Con control de llamadas
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&calls=false
```

#### Opción 6 - Combinación de controles
```
http://localhost:5173/dashboard?client_id=TU_CLIENT_ID&agenda=false&calls=false
```

### Ejemplos de Uso

1. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

2. **Acceder al dashboard con client_id:**
   ```
   http://localhost:5173/dashboard?client_id=12345
   ```

3. **Acceder al dashboard con api_key:**
   ```
   http://localhost:5173/dashboard?api_key=sk-abc123def456
   ```

4. **Acceder con ambos parámetros:**
   ```
   http://localhost:5173/dashboard?client_id=12345&api_key=sk-abc123def456
   ```

5. **Acceder sin funcionalidades de agenda:**
   ```
   http://localhost:5173/dashboard?client_id=12345&agenda=false
   ```

6. **Acceder sin funcionalidades de llamadas:**
   ```
   http://localhost:5173/dashboard?client_id=12345&calls=false
   ```

7. **Acceder con múltiples controles:**
   ```
   http://localhost:5173/dashboard?client_id=12345&agenda=false&calls=false
   ```

### Parámetros de URL

- **client_id** (opcional): El identificador único del cliente
- **api_key** (opcional): La API key de Retell AI
- **agenda** (opcional): Controla la visibilidad de las funcionalidades de agenda (true/false, por defecto true)
- **calls** (opcional): Controla la visibilidad de los botones de hacer llamadas (true/false, por defecto true)
- **Ejemplos:** 
  - `?client_id=12345`
  - `?api_key=sk-abc123def456`
  - `?client_id=12345&api_key=sk-abc123def456`
  - `?client_id=12345&agenda=false`
  - `?client_id=12345&calls=false`
  - `?client_id=12345&agenda=false&calls=false`

### Flujo de Funcionamiento

#### Con client_id:
1. **Carga inicial:** La aplicación lee el `client_id` de la URL
2. **Obtención de API key:** Se hace una petición al servidor para obtener la API key asociada al `client_id`
3. **Carga de datos:** Una vez obtenida la API key, se cargan automáticamente todos los datos

#### Con api_key:
1. **Carga inicial:** La aplicación lee la `api_key` de la URL
2. **Carga directa:** Se cargan directamente todos los datos usando la API key proporcionada

#### Con ambos parámetros:
1. **Prioridad:** Se usa la `api_key` directamente (más rápido)
2. **Client ID:** Se usa para obtener datos específicos del dashboard si es necesario

#### Con parámetro agenda:
1. **agenda=true (por defecto):** Se muestran todas las funcionalidades de agenda
2. **agenda=false:** Se ocultan:
   - La pestaña "Agendas" en la sidebar
   - Los widgets de "Total Agendamientos" y "Costo por Agenda" en el dashboard
   - El gráfico de "Agendamientos por Hora"
   - El gráfico de "Tipos de Vivienda"
   - La sección "Resumen Detallado de Tipos de Vivienda"
   - La sección "Análisis Detallado de Tipos de Vivienda"
   - Se redirige automáticamente al dashboard si se intenta acceder a la página de agendas

#### Con parámetro calls:
1. **calls=true (por defecto):** Se muestran los botones de hacer llamadas
2. **calls=false:** Se ocultan:
   - Los botones de "Hacer Llamada" en la sidebar
   - Los widgets de "Llamadas Totales" y "Costo por Llamada" en el dashboard
   - El gráfico de "Llamadas por Hora"
   - Se redirige automáticamente al dashboard si se intenta acceder a la página de llamadas

### Ventajas de cada opción

#### Solo client_id:
- ✅ Más seguro (la API key no se expone en la URL)
- ✅ Fácil de compartir (solo necesitas el client_id)
- ❌ Requiere una petición adicional al servidor

#### Solo api_key:
- ✅ Más rápido (no requiere petición al servidor)
- ✅ Funciona sin conexión al servidor de configuración
- ❌ La API key queda visible en la URL

#### Ambos parámetros:
- ✅ Combina las ventajas de ambos
- ✅ Flexibilidad máxima
- ❌ URL más larga

#### Solo agenda=false:
- ✅ Interfaz más limpia sin elementos de agenda
- ✅ Mejor rendimiento al no cargar datos de agenda
- ✅ Experiencia de usuario simplificada

#### Solo calls=false:
- ✅ Interfaz más segura sin funcionalidades de llamada
- ✅ Ideal para usuarios de solo lectura
- ✅ Previene llamadas accidentales

#### Combinación de controles:
- ✅ Máxima personalización de la experiencia
- ✅ Interfaz adaptada a diferentes roles de usuario
- ✅ Control granular de funcionalidades

### Manejo de Errores

- Si no se proporciona ningún parámetro, la aplicación mostrará un mensaje de error
- Si se proporciona `client_id` pero no se puede obtener la API key, se mostrará un error
- Si se proporciona `api_key` inválida, los errores se mostrarán al intentar cargar los datos

### Seguridad

- **client_id**: Debe ser proporcionado por el administrador del sistema
- **api_key**: Se puede obtener directamente de Retell AI
- La API key se obtiene de forma segura desde el servidor cuando se usa solo client_id
- Al usar api_key directamente, esta queda visible en la URL

### Compatibilidad

Este sistema es compatible con:
- Navegadores modernos (Chrome, Firefox, Safari, Edge)
- Dispositivos móviles y de escritorio
- Todas las funcionalidades existentes del dashboard

## 📞 **Funcionalidades de Llamadas**

### **Funciones Disponibles:**

#### **1. `listCalls(apiKey, params)`**
Obtiene llamadas con filtros específicos usando el endpoint `/api/calls/list-calls`.

**Método:** POST con filtros en el body

**Parámetros disponibles:**
- `client_id`: ID del cliente (ej: "mas_sol001")
- `from_number`: Número de origen (ej: "+34612345678")
- `to_number`: Número de destino (ej: "+34687654321")
- `status`: Estado de la llamada (ej: "efectiva" o "fallida")
- `fecha_inicio`: Fecha de inicio (ej: "2024-01-01")
- `fecha_fin`: Fecha de fin (ej: "2024-12-31")
- `sort_order`: Orden de resultados ("ASC" o "DESC")
- `page`: Número de página (ej: 1)
- `per_page`: Registros por página (máx 100)

**Ejemplo de uso:**
```javascript
import { listCalls } from './api';

// Obtener llamadas efectivas de un período específico
const calls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "efectiva",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC",
  page: 1,
  per_page: 50
});

console.log(`Total de llamadas: ${calls.total_calls}`);
console.log(`Página actual: ${calls.current_page} de ${calls.total_pages}`);
```

#### **2. `fetchAllCallsWithListCalls(apiKey, params)`**
Obtiene TODAS las llamadas con paginación automática usando el endpoint list-calls.

**Parámetros disponibles:**
- `client_id`: ID del cliente
- `from_number`: Número de origen
- `to_number`: Número de destino
- `status`: Estado de la llamada
- `fecha_inicio`: Fecha de inicio
- `fecha_fin`: Fecha de fin
- `sort_order`: Orden de resultados

**Ejemplo de uso:**
```javascript
import { fetchAllCallsWithListCalls } from './api';

// Obtener todas las llamadas de un cliente
const allCalls = await fetchAllCallsWithListCalls(apiKey, {
  client_id: "mas_sol001",
  sort_order: "DESC"
});

console.log(`Total de llamadas obtenidas: ${allCalls.length}`);
```

### **Casos de Uso Comunes:**

#### **Para Reportes de Ventas:**
```javascript
const salesCalls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "efectiva",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC"
});
```

#### **Para Análisis de Problemas:**
```javascript
const failedCalls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  status: "fallida",
  per_page: 25,
  sort_order: "DESC"
});
```

#### **Para Auditoría de Números:**
```javascript
const numberCalls = await listCalls(apiKey, {
  from_number: "+34612345678",
  sort_order: "ASC"
});
```

#### **Para Dashboard en Tiempo Real:**
```javascript
const recentCalls = await listCalls(apiKey, {
  client_id: "mas_sol001",
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  sort_order: "DESC",
  page: 1,
  per_page: 100
});
```

### **Estructura de Respuesta:**
```javascript
{
  calls: RetellCall[],           // Array de llamadas
  total_pages?: number,          // Total de páginas disponibles
  total_calls?: number,          // Total de llamadas que coinciden con los filtros
  current_page?: number          // Página actual
}
```

### **Tips de Uso:**
- **Paginación**: Usa `per_page` para controlar la cantidad de resultados
- **Orden**: `ASC` para análisis cronológico, `DESC` para ver lo más reciente
- **Fechas**: Si solo envías fecha (YYYY-MM-DD), se interpreta como todo el día
- **Combinaciones**: Puedes combinar todos los filtros según necesites
- **Performance**: Usa filtros específicos para consultas más rápidas

## 📱 **Funcionalidades de Números de Teléfono**

### Lista de Números
Lista todos tus números telefónicos con información detallada:
- Número formateado
- Tipo de número
- Código de área
- Agentes asociados
- Fecha de última modificación

#### Añadir nuevos números de teléfono
Para añadir un nuevo número de teléfono:
1. Ve a la sección "Números de Teléfono"
2. Haz clic en el botón "Añadir Número"
3. Completa el formulario con:
   - **Número de teléfono** (obligatorio): Formato +[código de país][número]
   - **Nombre** (opcional): Identificador personalizado
   - **URI de terminación** (opcional): Para configuración SIP
   - **Usuario SIP** (opcional): Credenciales de autenticación
   - **Contraseña SIP** (opcional): Credenciales de autenticación
4. Haz clic en "Añadir número"
5. El número se añadirá automáticamente a tu lista

#### Eliminar números de teléfono
Para eliminar un número de teléfono:
1. Ve a la sección "Números de Teléfono"
2. Encuentra el número que quieres eliminar
3. Haz clic en el botón "Eliminar" (icono de papelera)
4. Confirma la eliminación en el modal de confirmación
5. El número se eliminará permanentemente de tu cuenta
