import { addDoc, collection } from 'firebase/firestore'
import { getFirestoreClient } from './firebaseClient'

// Salva diretamente no Firestore (frontend) em {campanha}-experience
export async function saveExperience(campanha: string, data: Record<string, any>) {
  try {
    const { db } = getFirestoreClient()
    const colName = `${campanha}-experience`

    const docData = {
      data: {...data},
      createdAt: new Date().toISOString(),
    }

    const docRef = await addDoc(collection(db, colName), docData)
    return { ok: true, id: docRef.id, data: docData }
  } catch (err: any) {
    const message = err?.message || 'Erro desconhecido ao salvar experiência'
    throw new Error(message)
  }
}