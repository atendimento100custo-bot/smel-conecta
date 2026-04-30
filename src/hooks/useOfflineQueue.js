import { useEffect, useState } from 'react'

const QUEUE_KEY = 'smel_offline_queue'

export function useOfflineQueue() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    setPending(JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length)
    const timer = setInterval(() => {
      setPending(JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const addToQueue = (data) => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    queue.push({ ...data, _id: Date.now(), _at: new Date().toISOString() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    setPending(queue.length)
  }

  const clearQueue = () => {
    localStorage.removeItem(QUEUE_KEY)
    setPending(0)
  }

  return { offline, pending, addToQueue, clearQueue }
}
