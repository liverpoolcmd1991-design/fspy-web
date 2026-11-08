/**
 * fSpy Studio — Opt-In Local Browser Workspace Persistence (IndexedDB)
 * Only runs when the user explicitly opts into "Auto-save session locally".
 */

import SavedState from './saved-state'

const DB_NAME = 'fspy_studio_workspace_db'
const STORE_NAME = 'active_session'
const SESSION_KEY = 'current_project'
const OPT_IN_PREF_KEY = 'fspy_studio_autosave_opt_in'

export interface PersistedWorkspacePayload {
  savedState: SavedState
  projectName: string | null
  imageWidth: number | null
  imageHeight: number | null
  imageBytes: Uint8Array | null
  updatedAt: number
}

export function getAutoSaveOptInPreference(): boolean {
  try {
    return localStorage.getItem(OPT_IN_PREF_KEY) === 'true'
  } catch {
    return false
  }
}

export function setAutoSaveOptInPreference(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(OPT_IN_PREF_KEY, 'true')
    } else {
      localStorage.removeItem(OPT_IN_PREF_KEY)
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function openWorkspaceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function saveWorkspaceToIndexedDB(
  payload: PersistedWorkspacePayload
): Promise<void> {
  try {
    const db = await openWorkspaceDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(payload, SESSION_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
    db.close()
  } catch {
    // Fail silently if IndexedDB is blocked
  }
}

export async function loadWorkspaceFromIndexedDB(): Promise<PersistedWorkspacePayload | null> {
  try {
    const db = await openWorkspaceDB()
    const result = await new Promise<PersistedWorkspacePayload | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(SESSION_KEY)
        req.onsuccess = () =>
          resolve((req.result as PersistedWorkspacePayload | undefined) ?? null)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
      }
    )
    db.close()
    return result
  } catch {
    return null
  }
}

export async function clearWorkspaceIndexedDB(): Promise<void> {
  try {
    const db = await openWorkspaceDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(SESSION_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB clear failed'))
    })
    db.close()
  } catch {
    // Ignore errors
  }
}
