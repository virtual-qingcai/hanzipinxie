
import { ImageItem } from "../types";

const DB_NAME = 'HanziTouchDB';
const DB_VERSION = 4; // Incremented for schema change (added audioText)
const STORE_NAME = 'state';
const DATA_KEY = 'appData';

export interface AppData {
  appTitle: string;
  images: ImageItem[];
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Check if indexedDB is available
    if (!window.indexedDB) {
        reject(new Error("IndexedDB not supported"));
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveAppData = async (data: AppData) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, DATA_KEY);
    
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save data to IndexedDB", err);
  }
};

export const loadAppData = async (): Promise<AppData | undefined> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(DATA_KEY);
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to load data from IndexedDB", err);
    return undefined;
  }
};