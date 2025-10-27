// Server-only: initialize Firebase Admin using service account from env
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function getFirebaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('firebaseAdmin só deve ser usado no ambiente Node (server-side).')
  }

  const raw = process.env.VITE_FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    throw new Error('VITE_FIREBASE_SERVICE_ACCOUNT_KEY não definido no ambiente.')
  }

  let serviceAccount: any
  try {
    serviceAccount = JSON.parse(raw)
  } catch (e) {
    throw new Error('VITE_FIREBASE_SERVICE_ACCOUNT_KEY inválido (JSON parse falhou).')
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount as any),
      projectId: serviceAccount.project_id,
    })
  }
  const db = getFirestore()
  return { db }
}