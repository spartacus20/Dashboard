import { useState, useEffect } from 'react'
import { 
  getUserData, 
  getApiKey, 
  getClientIdFromSession, 
  getEmail, 
  getFullName, 
  getMetadata, 
  getMetadataLlamadas 
} from '../lib/supabase'

interface UserData {
  apiKey: string | null
  clientId: string | null
  email: string | null
  fullName: string | null
  metadata: any
  metadata_llamadas: any
}

export const useUserData = () => {
  const [userData, setUserData] = useState<UserData>({
    apiKey: null,
    clientId: null,
    email: null,
    fullName: null,
    metadata: null,
    metadata_llamadas: null
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar datos del sessionStorage
    const loadUserData = () => {
      const data: UserData = {
        apiKey: getApiKey(),
        clientId: getClientIdFromSession(),
        email: getEmail(),
        fullName: getFullName(),
        metadata: getMetadata(),
        metadata_llamadas: getMetadataLlamadas()
      }
      
      setUserData(data)
      setLoading(false)
    }

    loadUserData()

    // Escuchar cambios en el sessionStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.storageArea === sessionStorage) {
        loadUserData()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Función para refrescar los datos
  const refreshUserData = () => {
    const data: UserData = {
      apiKey: getApiKey(),
      clientId: getClientIdFromSession(),
      email: getEmail(),
      fullName: getFullName(),
      metadata: getMetadata(),
      metadata_llamadas: getMetadataLlamadas()
    }
    
    setUserData(data)
  }

  return {
    userData,
    loading,
    refreshUserData,
    // Getters individuales para conveniencia
    apiKey: userData.apiKey,
    clientId: userData.clientId,
    email: userData.email,
    fullName: userData.fullName,
    metadata: userData.metadata,
    metadata_llamadas: userData.metadata_llamadas
  }
}
