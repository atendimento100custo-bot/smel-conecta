// src/hooks/usePoloCoords.js
// Geocodifica os polos via Nominatim (OpenStreetMap) com cache em localStorage.
// Taxa: 1 req/seg para respeitar o limite do Nominatim.

import { useState, useEffect } from 'react'

const CACHE_KEY = 'smel_polo_coords_v2'
const DELAY_MS = 1200 // 1.2s entre requests

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

async function geocode(polo) {
  // Tenta endereço completo primeiro, depois só bairro + cidade
  const queries = [
    polo.endereco ? `${polo.endereco}, Volta Redonda, Rio de Janeiro, Brasil` : null,
    `${polo.bairro}, Volta Redonda, Rio de Janeiro, Brasil`,
    `${polo.nome}, Volta Redonda, Rio de Janeiro, Brasil`,
  ].filter(Boolean)

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
      const data = await res.json()
      if (data?.[0]) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      }
    } catch {}
    await new Promise(r => setTimeout(r, DELAY_MS))
  }
  // Fallback: centro de Volta Redonda
  return [-22.523, -44.099]
}

export function usePoloCoords(polos) {
  const [coords, setCoords] = useState(() => loadCache())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!polos?.length) return

    const cache = loadCache()
    const missing = polos.filter(p => !cache[p.id])

    if (!missing.length) {
      setCoords(cache)
      return
    }

    setLoading(true)
    let cancelled = false

    async function run() {
      const updated = { ...cache }
      for (const polo of missing) {
        if (cancelled) break
        const latLng = await geocode(polo)
        updated[polo.id] = latLng
        saveCache(updated)
        if (!cancelled) setCoords({ ...updated })
        await new Promise(r => setTimeout(r, DELAY_MS))
      }
      if (!cancelled) setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [polos?.length])

  return { coords, loading }
}
