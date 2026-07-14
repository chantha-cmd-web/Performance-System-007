import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function ensureFirebaseAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Failed to sign in anonymously with Firebase", e);
    }
  }
}

// Test Connection
let isConnectionTested = false;
export async function testConnection() {
  if (isConnectionTested) return;
  try {
    await ensureFirebaseAuth();
    await getDocFromServer(doc(db, 'test', 'connection'));
    isConnectionTested = true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

function getDraftDocPath(userId: string, editId: string) {
  const cleanEditId = editId || 'new';
  return `evaluation_autosaves/${userId}_${cleanEditId}`;
}

export async function saveEvaluationDraft(
  userId: string,
  editId: string,
  formData: any,
  criteriaScores: any[],
  peerFeedbacks: any[]
) {
  await ensureFirebaseAuth();
  const path = getDraftDocPath(userId, editId);
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, {
      userId,
      editId: editId || 'new',
      formData: {
        employeeId: formData.employeeId || '',
        employeeName: formData.employeeName || '',
        campus: formData.campus || '',
        department: formData.department || '',
        position: formData.position || '',
        category: formData.category || '',
        appraiser: formData.appraiser || '',
        supporter: formData.supporter || '',
        evalPeriod: formData.evalPeriod || '',
        reviewDate: formData.reviewDate || '',
        weightScheme: formData.weightScheme || '',
        evaluationType: formData.evaluationType || '',
        status: formData.status || 'Draft',
        evaluatorComments: formData.evaluatorComments || ''
      },
      criteriaScores,
      peerFeedbacks,
      lastSavedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadEvaluationDraft(userId: string, editId: string) {
  await ensureFirebaseAuth();
  const path = getDraftDocPath(userId, editId);
  try {
    const docRef = doc(db, path);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteEvaluationDraft(userId: string, editId: string) {
  await ensureFirebaseAuth();
  const path = getDraftDocPath(userId, editId);
  try {
    const docRef = doc(db, path);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
