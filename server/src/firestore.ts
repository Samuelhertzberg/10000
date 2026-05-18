import { Firestore } from '@google-cloud/firestore'

let _db: Firestore | null = null

export const db = (): Firestore => {
  if (_db) return _db
  _db = new Firestore({
    projectId: process.env.GCP_PROJECT,
    // FIRESTORE_EMULATOR_HOST is picked up automatically when set.
  })
  return _db
}
