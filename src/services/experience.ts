import { addDoc, collection, getDocs, query, where, limit } from 'firebase/firestore'
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

// Busca um registro pelo CPF dentro da coleção {campanha}-experience
export async function findExperienceByCpf(campanha: string, cpf: string) {
  try {
    const { db } = getFirestoreClient()
    const colName = `${campanha}-experience`
    const q = query(
      collection(db, colName),
      where('data.cpf', '==', cpf),
      limit(1)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const doc = snap.docs[0]
    const payload = doc.data() as any
    return { id: doc.id, data: payload?.data || {} }
  } catch (err: any) {
    const message = err?.message || 'Erro ao buscar experiência por CPF'
    throw new Error(message)
  }
}