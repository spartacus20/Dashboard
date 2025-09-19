# Sistema de Autenticación con Supabase

Este documento explica cómo configurar y usar el sistema de autenticación implementado en el dashboard.

## Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=tu_url_de_supabase_aqui
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase_aqui

# Get-Client API Configuration
VITE_GET_CLIENT_API_URL=https://api.get-client.com
VITE_GET_CLIENT_CLIENT_ID=tu_client_id_aqui
```

### 2. Configuración de Supabase

Ejecuta el siguiente SQL en tu base de datos de Supabase para crear las tablas necesarias:

```sql
-- Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Función para crear automáticamente un perfil cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función cuando se crea un nuevo usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función para actualizar el timestamp de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS handle_profiles_updated_at ON public.profiles;
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 3. Configuración de Proveedores OAuth

En el panel de Supabase, ve a Authentication > Providers y configura:

- **Google OAuth**: Configura tu Client ID y Client Secret de Google
- **GitHub OAuth**: Configura tu Client ID y Client Secret de GitHub

## Características del Sistema

### Autenticación
- ✅ Login con email y contraseña
- ✅ Registro de nuevos usuarios
- ✅ Login con Google OAuth
- ✅ Login con GitHub OAuth
- ✅ Cerrar sesión
- ✅ Restablecimiento de contraseña

### Protección de Rutas
- ✅ Todas las rutas del dashboard están protegidas
- ✅ Redirección automática al login si no está autenticado
- ✅ Estado de carga mientras se verifica la autenticación

### Gestión de Usuarios
- ✅ Perfil de usuario automático al registrarse
- ✅ Información del usuario en el sidebar
- ✅ Botón de cerrar sesión

## Configuración de Get-Client

### Obtener Client ID
El Client ID se obtiene automáticamente cuando te logueas y se almacena en localStorage:

1. **Automático**: Al hacer login (email/contraseña o OAuth), se envía una petición POST a `http://localhost:3000/get-client` con tu email
2. **Almacenamiento**: El `client_id` se guarda automáticamente en localStorage usando la clave `get_client_id`
3. **Uso en peticiones**: Todas las peticiones HTTP usan automáticamente el `client_id` del localStorage
4. **Manual**: En el dashboard, en la sección "Configuración Get-Client", puedes hacer clic en "Obtener" para obtenerlo nuevamente
5. **Configuración manual**: Si prefieres, puedes ingresar manualmente tu Client ID de get-client

### Uso del Client ID
El Client ID se almacena localmente en el navegador usando la clave `get_client_id` y se utiliza para:
- Acceder a los servicios de get-client
- Realizar llamadas a la API de get-client
- Autenticación con servicios externos

**Nota importante**: El sistema ya no depende de los parámetros de URL para obtener el `client_id`. En su lugar, utiliza el `client_id` almacenado en localStorage, lo que hace el sistema más seguro y confiable.

### Limpieza de Datos
- **Al cerrar sesión**: El `client_id` se elimina automáticamente del localStorage para mayor seguridad
- **Al iniciar sesión**: Se obtiene un nuevo `client_id` del endpoint `get-client`

## Estructura de Archivos

```
src/
├── context/
│   └── AuthContext.tsx          # Contexto de autenticación
├── components/
│   ├── Login.tsx                # Componente de login
│   ├── ProtectedRoute.tsx       # Componente de protección de rutas
│   └── GetClientConfig.tsx      # Configuración de get-client
├── lib/
│   └── supabase.ts              # Configuración de Supabase
└── pages/
    └── Dashboard.tsx            # Dashboard con configuración integrada
```

## Uso en el Código

### Hook useAuth
```tsx
import { useAuth } from '../context/AuthContext'

function MyComponent() {
  const { user, signIn, signOut, loading } = useAuth()
  
  if (loading) return <div>Cargando...</div>
  if (!user) return <div>No autenticado</div>
  
  return <div>¡Hola {user.email}!</div>
}
```

### Obtener Client ID de get-client
```tsx
import { getClientId, get_client_id } from '../lib/supabase'

// Obtener desde la API (requiere email del usuario)
const clientId = await getClientId(user.email)

// Obtener desde localStorage usando la variable
const storedClientId = localStorage.getItem(get_client_id)
```

### Endpoint de Get-Client
El sistema utiliza el siguiente endpoint para obtener el Client ID:

**POST** `http://localhost:3000/get-client`

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Respuesta esperada:**
```json
{
  "client_id": "tu_client_id_aqui"
}
```

## Seguridad

- ✅ Row Level Security (RLS) habilitado en Supabase
- ✅ Políticas de seguridad para perfiles de usuario
- ✅ Tokens de autenticación manejados por Supabase
- ✅ Client ID almacenado localmente usando la variable `get_client_id` (considera usar variables de entorno en producción)

## Troubleshooting

### Error: "useAuth debe ser usado dentro de un AuthProvider"
- Asegúrate de que el componente esté envuelto en `<AuthProvider>`

### Error: "No se pudo obtener el client_id de get-client"
- Verifica que la URL de la API sea correcta
- Asegúrate de que el endpoint `/client-id` esté disponible
- Configura manualmente el Client ID si es necesario

### Error de autenticación con OAuth
- Verifica que los proveedores OAuth estén configurados en Supabase
- Asegúrate de que las URLs de redirección sean correctas
- Verifica que los Client ID y Client Secret sean válidos
