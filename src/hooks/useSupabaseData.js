// src/hooks/useSupabaseData.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseData(table, query = '') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let req = supabase.from(table).select(query || '*').range(0, 9999)
    const { data: rows, error: err } = await req
    setData(rows ?? [])
    setError(err)
    setLoading(false)
  }, [table, query])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
