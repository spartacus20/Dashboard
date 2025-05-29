import { createClient } from '@supabase/supabase-js'

// Estas variables deberían estar en un archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type AuthUser = {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
} 