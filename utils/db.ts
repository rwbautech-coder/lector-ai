import { Book, UserProfile, AppSettings } from '../types';

const DB_NAME = 'LectorAI_DB';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('Database error: ' + (event.target as IDBOpenDBRequest).error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for Books (KeyPath: id)
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('userId', 'userId', { unique: false });
      }

      // Store for Users (KeyPath: id)
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }

      // Store for App Settings (KeyPath: id)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
  });
};

export const saveBookToLocal = async (userId: string, book: Book): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books'], 'readwrite');
    const store = transaction.objectStore('books');
    // We add userId to the stored object to segregate users
    const storedBook = { ...book, userId }; 
    const request = store.put(storedBook);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getBooksForUser = async (userId: string): Promise<Book[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books'], 'readonly');
    const store = transaction.objectStore('books');
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => {
        // Strip the userId field before returning to match Book type
        const books = request.result.map(b => {
            const { userId: _, ...book } = b;
            return book as Book;
        });
        resolve(books);
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ ...settings, id: 'config' });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getSettings = async (): Promise<AppSettings> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get('config');
    request.onsuccess = () => resolve(request.result || {});
    request.onerror = () => reject(request.error);
  });
};

export const saveUser = async (user: UserProfile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getUser = async (userId: string): Promise<UserProfile | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['users'], 'readonly');
    const store = transaction.objectStore('users');
    const request = store.get(userId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};