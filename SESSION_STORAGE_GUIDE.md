# 📦 Guía de SessionStorage - Mas Sol Dashboard

## 🎯 **¿Qué se implementó?**

Se modificó el sistema de autenticación para que **automáticamente** guarde todos los datos del usuario en `sessionStorage` cuando inicie sesión.

## 🔄 **Flujo de Autenticación Actualizado**

```
1. Usuario inicia sesión (email/password)
   ↓
2. Supabase autentica al usuario
   ↓
3. Se llama a getClientId(email)
   ↓
4. Se hace POST a /get-client con el email
   ↓
5. Backend devuelve TODOS los datos del cliente
   ↓
6. Frontend guarda AUTOMÁTICAMENTE en sessionStorage:
   - userData (completo)
   - apiKey
   - clientId
   - email
   - fullName
   - metadata
   - metadata_llamadas
```

## 📋 **Datos Guardados en SessionStorage**

### **Claves del SessionStorage:**

- `userData` - Objeto completo con todos los datos
- `apiKey` - Clave API del cliente
- `clientId` - ID único del cliente
- `email` - Email del usuario
- `fullName` - Nombre completo
- `metadata` - Metadatos generales (JSON)
- `metadata_llamadas` - Metadatos de llamadas (JSON)

### **Estructura de metadata_llamadas:**

```json
{
  "total_llamadas": 150,
  "llamadas_exitosas": 120,
  "llamadas_fallidas": 30,
  "duracion_promedio": 300,
  "duracion_total": 45000,
  "ultima_llamada": "2024-01-15T10:30:00Z",
  "estadisticas_por_dia": {...},
  "configuracion": {...}
}
```

## 🛠️ **Funciones Disponibles**

### **En `lib/supabase.ts`:**

```typescript
// Obtener datos individuales
getUserData(); // Objeto completo
getApiKey(); // string | null
getClientIdFromSession(); // string | null
getEmail(); // string | null
getFullName(); // string | null
getMetadata(); // object | null
getMetadataLlamadas(); // object | null

// Limpiar datos
clearSessionData(); // void
```

### **Hook personalizado `useUserData`:**

```typescript
import { useUserData } from "../hooks/useUserData";

const MyComponent = () => {
  const {
    userData, // Objeto completo
    loading, // boolean
    refreshUserData, // función para refrescar
    apiKey, // string | null
    clientId, // string | null
    email, // string | null
    fullName, // string | null
    metadata, // object | null
    metadata_llamadas, // object | null
  } = useUserData();

  // Usar los datos...
};
```

## 💡 **Ejemplos de Uso**

### **1. Acceso directo a funciones:**

```typescript
import { getApiKey, getMetadataLlamadas } from "../lib/supabase";

const MyComponent = () => {
  const apiKey = getApiKey();
  const metadataLlamadas = getMetadataLlamadas();

  // console.log('API Key:', apiKey)
  // console.log('Total llamadas:', metadataLlamadas?.total_llamadas)
};
```

### **2. Usando el hook:**

```typescript
import { useUserData } from '../hooks/useUserData'

const Dashboard = () => {
  const { apiKey, metadata_llamadas, loading } = useUserData()

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total llamadas: {metadata_llamadas?.total_llamadas || 0}</p>
      <p>Llamadas exitosas: {metadata_llamadas?.llamadas_exitosas || 0}</p>
    </div>
  )
}
```

### **3. Componente de ejemplo:**

```typescript
import UserDataDisplay from '../components/UserDataDisplay'

const SettingsPage = () => {
  return (
    <div>
      <h1>Configuración</h1>
      <UserDataDisplay />
    </div>
  )
}
```

## 🔧 **Configuración**

### **URL del Backend:**

El sistema ahora usa el endpoint local:

```typescript
// En lib/supabase.ts
const response = await fetch("http://localhost:3000/get-client", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email }),
});
```

### **Variables de Entorno:**

Asegúrate de que tu backend esté corriendo en `http://localhost:3000`

## 🧹 **Limpieza Automática**

Los datos se limpian automáticamente cuando:

- El usuario cierra sesión (`signOut()`)
- Se cierra la pestaña del navegador (sessionStorage se limpia automáticamente)

## 🚨 **Notas Importantes**

1. **SessionStorage vs LocalStorage:**
   - `sessionStorage` se limpia al cerrar la pestaña
   - `localStorage` persiste hasta que se limpie manualmente
   - Los datos sensibles están en `sessionStorage` por seguridad

2. **Compatibilidad:**
   - Se mantiene `localStorage` para `client_id` (compatibilidad hacia atrás)
   - Los nuevos datos van a `sessionStorage`

3. **Seguridad:**
   - `apiKey` está en `sessionStorage` (más seguro)
   - Se limpia automáticamente al cerrar sesión

## 🐛 **Debugging**

### **Ver datos en consola:**

```javascript
// En la consola del navegador
// console.log("UserData:", JSON.parse(sessionStorage.getItem("userData")));
// console.log(
//   "Metadata Llamadas:",
//   JSON.parse(sessionStorage.getItem("metadata_llamadas")),
// );
```

### **Verificar que se guardaron:**

```javascript
// En la consola del navegador
// Object.keys(sessionStorage).forEach((key) => {
//   console.log(key, sessionStorage.getItem(key));
// });
```

## 📱 **Uso en Componentes**

### **Dashboard con estadísticas:**

```typescript
const Dashboard = () => {
  const { metadata_llamadas } = useUserData()

  const stats = metadata_llamadas || {}

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        title="Total Llamadas"
        value={stats.total_llamadas || 0}
      />
      <StatCard
        title="Llamadas Exitosas"
        value={stats.llamadas_exitosas || 0}
      />
      <StatCard
        title="Duración Promedio"
        value={`${stats.duracion_promedio || 0}s`}
      />
      <StatCard
        title="Última Llamada"
        value={stats.ultima_llamada ?
          new Date(stats.ultima_llamada).toLocaleDateString() :
          'N/A'
        }
      />
    </div>
  )
}
```

¡Ahora tienes acceso completo a todos los metadatos del cliente directamente desde el sessionStorage! 🎉
