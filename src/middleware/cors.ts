import { corsHeaders } from '../lib/cors'

export const handleCors = async (req: Request) => {
  // Manejar peticiones OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Para otras peticiones, añadir los headers de CORS
    const response = await fetch(req.url, {
      method: req.method,
      headers: {
        ...Object.fromEntries(req.headers),
        ...corsHeaders
      },
      body: req.body
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        ...corsHeaders
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
} 