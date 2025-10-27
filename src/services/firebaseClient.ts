import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

function parseJsonFromEnv(raw?: string): any | undefined {
  if (!raw) return undefined
  try {
    const cleaned = raw.replace(/`/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return undefined
  }
}

function resolveWebConfigFromObject(obj: any | undefined) {
  const projectId: string | undefined = obj?.project_id || obj?.projectId
  const apiKey: string | undefined = obj?.private_key
  const appId: string | undefined = obj?.private_key_id
  const messagingSenderId: string | undefined = obj?.messagingSenderId || obj?.messaging_sender_id
  const authDomain: string | undefined = obj?.authDomain || (projectId ? `${projectId}.firebaseapp.com` : undefined)
  const storageBucket: string | undefined = obj?.storageBucket || (projectId ? `${projectId}.appspot.com` : undefined)

  return { projectId, apiKey, appId, messagingSenderId, authDomain, storageBucket }
}

export function getFirestoreClient() {
  if (typeof window === 'undefined') {
    throw new Error('firebaseClient deve ser usado no frontend (browser).')
  }

  const obj = parseJsonFromEnv(import.meta.env.VITE_FIREBASE_SERVICE_ACCOUNT_KEY as string | undefined)
  const fromObj = resolveWebConfigFromObject(obj)

  const projectId = (fromObj.projectId || (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined))
  const apiKey = (fromObj.apiKey || (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined))
  const appId = (fromObj.appId || (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined))
  const messagingSenderId = (fromObj.messagingSenderId || (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined))
  const authDomain = (fromObj.authDomain || (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined))
  const storageBucket = (fromObj.storageBucket || (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined))

  if (!projectId) {
    throw new Error('Project ID ausente. Forneça projectId no objeto VITE_FIREBASE_SERVICE_ACCOUNT_KEY ou defina VITE_FIREBASE_PROJECT_ID.')
  }
  if (!apiKey || !appId) {
    throw new Error('apiKey/appId ausentes. Para usar Web SDK no cliente, inclua apiKey e appId no objeto VITE_FIREBASE_SERVICE_ACCOUNT_KEY ou nas variáveis VITE_FIREBASE_*.')
  }

  const config = {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: storageBucket || `${projectId}.appspot.com`,
    messagingSenderId,
    appId,
  }

  if (getApps().length === 0) {
    initializeApp(config)
  }
  const db = getFirestore()
  return { db }
}