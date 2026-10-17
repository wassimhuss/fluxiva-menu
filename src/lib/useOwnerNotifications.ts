import { useCallback, useEffect, useRef, useState } from 'react'
import { getOwnerNotifications, readOwnerNotification } from './api'
import { notificationError } from './notificationI18n'
import type { OwnerNotificationPage } from './types'

export function useOwnerNotifications(accountKey: string, refreshToken: number) {
  const [state, setState] = useState<{ account: string; data: OwnerNotificationPage | null }>({ account: accountKey, data: null })
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [reading, setReading] = useState('')
  const account = useRef(accountKey); account.current = accountKey
  const currentPage = state.account === accountKey ? page : 0
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => { setReading('') }, [accountKey])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    getOwnerNotifications(currentPage, controller.signal).then(data => {
      if (!controller.signal.aborted) { setState({ account: accountKey, data }); setPage(currentPage) }
    }).catch(() => { if (!controller.signal.aborted) setError('Could not load notifications.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accountKey, currentPage, refreshToken, attempt])
  useEffect(() => {
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [refresh])
  async function markRead(id: string) {
    if (reading) return
    const owner = accountKey
    setReading(id); setError('')
    try { await readOwnerNotification(id); if (account.current === owner) refresh() }
    catch (cause) { if (account.current === owner) setError(notificationError(cause, 'Could not mark this message as read.')) }
    finally { if (account.current === owner) setReading('') }
  }
  return { data: state.account === accountKey ? state.data : null, page: currentPage, setPage, loading, error, reading, markRead, refresh }
}
