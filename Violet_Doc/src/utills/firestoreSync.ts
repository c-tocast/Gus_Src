import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  deleteDoc,
  writeBatch,
} from '../firebase';
import { Task, Person, ChatMessage, AppSettings, ChatSession } from '../types';
import {
  loadTasks,
  loadPeople,
  loadSettings,
  loadSessions,
  loadChatMessages,
  sanitizeTasks,
  sanitizePeople,
} from './storage';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  migrated?: boolean;
  updatedAt?: string;
}

/**
 * Perform automatic migration of local data to Firestore if user logs in for first time
 */
export async function migrateLocalDataToFirestore(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<boolean> {
  if (!user.uid) return false;

  const userDocRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userDocRef);

  // If user document already exists and has been marked as migrated, skip initial migration
  if (userSnap.exists() && userSnap.data()?.migrated) {
    return false;
  }

  // Gather local storage data
  const localTasks = loadTasks();
  const localPeople = loadPeople();
  const localSettings = loadSettings();
  const localSessions = loadSessions();
  const localChat = loadChatMessages();

  const batch = writeBatch(db);

  // User Profile
  batch.set(
    userDocRef,
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      migrated: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // Tasks
  localTasks.forEach((task) => {
    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    batch.set(taskRef, task, { merge: true });
  });

  // People
  localPeople.forEach((person) => {
    const personRef = doc(db, 'users', user.uid, 'people', person.id);
    batch.set(personRef, person, { merge: true });
  });

  // Settings
  const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
  batch.set(settingsRef, localSettings, { merge: true });

  // Sessions
  localSessions.forEach((session) => {
    const sessionRef = doc(db, 'users', user.uid, 'sessions', session.id);
    batch.set(sessionRef, session, { merge: true });
  });

  // Active Chat Messages
  const chatRef = doc(db, 'users', user.uid, 'chat', 'active');
  batch.set(chatRef, { messages: localChat }, { merge: true });

  await batch.commit();
  console.log('Successfully migrated local data to Firestore for user:', user.email);
  return true;
}

/**
 * Real-time subscribers for Firestore collections
 */
export function subscribeUserTasks(userId: string, callback: (tasks: Task[]) => void) {
  const colRef = collection(db, 'users', userId, 'tasks');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((d) => d.data() as Task);
      const { sanitized, hasChanges } = sanitizeTasks(tasks);
      if (hasChanges) {
        syncTasksToFirestore(userId, sanitized).catch((e) =>
          console.warn('Auto-healing sanitized tasks sync error:', e)
        );
      }
      callback(sanitized);
    },
    (err) => console.warn('Tasks snapshot listener error:', err)
  );
}

export async function syncTasksToFirestore(userId: string, tasks: Task[]) {
  if (!userId || tasks.length === 0) return;
  const batch = writeBatch(db);
  tasks.forEach((t) => {
    batch.set(doc(db, 'users', userId, 'tasks', t.id), t, { merge: true });
  });
  await batch.commit();
}

export async function syncPeopleToFirestore(userId: string, people: Person[]) {
  if (!userId || people.length === 0) return;
  const batch = writeBatch(db);
  people.forEach((p) => {
    batch.set(doc(db, 'users', userId, 'people', p.id), p, { merge: true });
  });
  await batch.commit();
}

export function subscribeUserPeople(
  userId: string,
  callback: (people: Person[]) => void,
  currentTasks?: Task[]
) {
  const colRef = collection(db, 'users', userId, 'people');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const rawPeople: Person[] = snapshot.docs.map((d) => d.data() as Person);
      const { sanitizedPeople, sanitizedTasks, idMap, hasChanges } = sanitizePeople(
        rawPeople,
        currentTasks
      );

      if (hasChanges) {
        syncPeopleToFirestore(userId, sanitizedPeople).catch((e) =>
          console.warn('Auto-healing sanitized people sync error:', e)
        );
        if (idMap && Object.keys(idMap).length > 0) {
          Object.keys(idMap).forEach((dupId) => {
            deleteCloudPerson(userId, dupId).catch((e) =>
              console.warn('Failed to delete duplicate person doc from Firestore:', e)
            );
          });
        }
        if (sanitizedTasks && sanitizedTasks.length > 0) {
          syncTasksToFirestore(userId, sanitizedTasks).catch((e) =>
            console.warn('Auto-healing remapped tasks sync error:', e)
          );
        }
      }

      callback(sanitizedPeople);
    },
    (err) => console.warn('People snapshot listener error:', err)
  );
}

export function subscribeUserSettings(userId: string, callback: (settings: AppSettings) => void) {
  const settingsRef = doc(db, 'users', userId, 'settings', 'main');
  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AppSettings);
      }
    },
    (err) => console.warn('Settings snapshot listener error:', err)
  );
}

export function subscribeUserSessions(userId: string, callback: (sessions: ChatSession[]) => void) {
  const colRef = collection(db, 'users', userId, 'sessions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const sessions: ChatSession[] = snapshot.docs.map((d) => d.data() as ChatSession);
      // Sort sessions descending
      sessions.sort((a, b) => (b.id > a.id ? 1 : -1));
      callback(sessions);
    },
    (err) => console.warn('Sessions snapshot listener error:', err)
  );
}

export function subscribeUserChat(userId: string, callback: (messages: ChatMessage[]) => void) {
  const chatRef = doc(db, 'users', userId, 'chat', 'active');
  return onSnapshot(
    chatRef,
    (snapshot) => {
      if (snapshot.exists() && snapshot.data()?.messages) {
        callback(snapshot.data().messages as ChatMessage[]);
      }
    },
    (err) => console.warn('Chat snapshot listener error:', err)
  );
}

/**
 * Direct Cloud Write Operations
 */
export async function saveCloudTask(userId: string, task: Task) {
  if (!userId) return;
  const taskRef = doc(db, 'users', userId, 'tasks', task.id);
  await setDoc(taskRef, task, { merge: true });
}

export async function deleteCloudTask(userId: string, taskId: string) {
  if (!userId) return;
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(taskRef);
}

export async function saveCloudPerson(userId: string, person: Person) {
  if (!userId) return;
  const personRef = doc(db, 'users', userId, 'people', person.id);
  await setDoc(personRef, person, { merge: true });
}

export async function deleteCloudPerson(userId: string, personId: string) {
  if (!userId) return;
  const personRef = doc(db, 'users', userId, 'people', personId);
  await deleteDoc(personRef);
}

export async function saveCloudSettings(userId: string, settings: AppSettings) {
  if (!userId) return;
  const settingsRef = doc(db, 'users', userId, 'settings', 'main');
  await setDoc(settingsRef, settings, { merge: true });
}

export async function saveCloudSession(userId: string, session: ChatSession) {
  if (!userId) return;
  const sessionRef = doc(db, 'users', userId, 'sessions', session.id);
  await setDoc(sessionRef, session, { merge: true });
}

export async function deleteCloudSession(userId: string, sessionId: string) {
  if (!userId) return;
  const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
  await deleteDoc(sessionRef);
}

export async function saveCloudChat(userId: string, messages: ChatMessage[]) {
  if (!userId) return;
  const chatRef = doc(db, 'users', userId, 'chat', 'active');
  await setDoc(chatRef, { messages }, { merge: true });
}

/**
 * Atomic Cross-Collection Cloud Data Wipe (Approach 4A & Approach 1B)
 */
export async function clearAllCloudData(userId: string): Promise<void> {
  if (!userId) return;

  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);

  // 1. Wipe tasks collection
  const tasksCol = collection(db, 'users', userId, 'tasks');
  const tasksSnap = await getDocs(tasksCol);
  tasksSnap.docs.forEach((d) => batch.delete(d.ref));

  // 2. Wipe people collection
  const peopleCol = collection(db, 'users', userId, 'people');
  const peopleSnap = await getDocs(peopleCol);
  peopleSnap.docs.forEach((d) => batch.delete(d.ref));

  // 3. Wipe sessions collection
  const sessionsCol = collection(db, 'users', userId, 'sessions');
  const sessionsSnap = await getDocs(sessionsCol);
  sessionsSnap.docs.forEach((d) => batch.delete(d.ref));

  // 4. Wipe chat active document
  const chatRef = doc(db, 'users', userId, 'chat', 'active');
  batch.delete(chatRef);

  // 5. Wipe settings main document
  const settingsRef = doc(db, 'users', userId, 'settings', 'main');
  batch.delete(settingsRef);

  // 6. Update root user profile metadata with tombstone timestamp and migration mark
  const userDocRef = doc(db, 'users', userId);
  batch.set(
    userDocRef,
    {
      migrated: true,
      lastResetAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  await batch.commit();
  console.log('Successfully completed atomic cross-collection cloud data scrub for user:', userId);
}

/**
 * Manual Full Cloud Sync (Approach 5B)
 */
export async function syncAllToCloud(
  userId: string,
  data: {
    tasks: Task[];
    people: Person[];
    settings: AppSettings;
    sessions: ChatSession[];
    messages: ChatMessage[];
  }
) {
  if (!userId) return;
  const batch = writeBatch(db);

  data.tasks.forEach((t) => {
    batch.set(doc(db, 'users', userId, 'tasks', t.id), t, { merge: true });
  });

  data.people.forEach((p) => {
    batch.set(doc(db, 'users', userId, 'people', p.id), p, { merge: true });
  });

  batch.set(doc(db, 'users', userId, 'settings', 'main'), data.settings, { merge: true });

  data.sessions.forEach((s) => {
    batch.set(doc(db, 'users', userId, 'sessions', s.id), s, { merge: true });
  });

  batch.set(doc(db, 'users', userId, 'chat', 'active'), { messages: data.messages }, { merge: true });

  await batch.commit();
}
