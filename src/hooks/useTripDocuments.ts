import { useCallback, useEffect, useState } from 'react'
import type { TripDocument } from 'schemas/tripDocuments'
import { readTripDocuments } from 'services/tripDocuments'
import { reportError } from 'utils/reportError'

// Imports the trip documents service statically: only the trip's page (lazy)
// uses this hook

export type TripDocumentsStatus = 'loading' | 'ready' | 'error'

export interface TripDocumentsState {
  status: TripDocumentsStatus
  documents: TripDocument[]
  retry: () => void
  /** One just uploaded, renamed or deleted here: shown at once. */
  added: (document: TripDocument) => void
  renamed: (id: string, name: string) => void
  removed: (id: string) => void
}

/** A trip's documents (backend specs/0037 RF-9), read when it opens. */
export const useTripDocuments = (
  orgId: string,
  tripId: string
): TripDocumentsState => {
  const [attempt, setAttempt] = useState(0)
  const [read, setRead] = useState<{
    key: string
    status: TripDocumentsStatus
    documents: TripDocument[]
  } | null>(null)
  const key = `${orgId}|${tripId}|${String(attempt)}`

  useEffect(() => {
    if (!orgId || !tripId) return
    let current = true
    readTripDocuments(orgId, tripId)
      .then(documents => {
        if (current) setRead({ key, status: 'ready', documents })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readTripDocuments' })
        if (current) setRead({ key, status: 'error', documents: [] })
      })
    return () => {
      current = false
    }
  }, [orgId, tripId, key])

  const change = useCallback(
    (update: (documents: TripDocument[]) => TripDocument[]) => {
      setRead(
        state => state && { ...state, documents: update(state.documents) }
      )
    },
    []
  )

  return {
    status: read?.key === key ? read.status : 'loading',
    documents: read?.key === key ? read.documents : [],
    retry: useCallback(() => {
      setAttempt(value => value + 1)
    }, []),
    added: useCallback(
      document => {
        change(documents => [...documents, document])
      },
      [change]
    ),
    renamed: useCallback(
      (id, name) => {
        change(documents =>
          documents.map(item => (item.id === id ? { ...item, name } : item))
        )
      },
      [change]
    ),
    removed: useCallback(
      id => {
        change(documents => documents.filter(item => item.id !== id))
      },
      [change]
    ),
  }
}
