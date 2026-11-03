import type { RugPlacement } from "./render";

const DB = "room-studio";
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((res, rej) => {
    if (!("indexedDB" in window)) return rej(new Error("IndexedDB is not available in this browser"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("uploads")) d.createObjectStore("uploads", { keyPath: "id" });
      if (!d.objectStoreNames.contains("thumbs")) d.createObjectStore("thumbs");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error("Could not open local database"));
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then((d) => new Promise<T>((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error ?? new Error("Storage request failed"));
  }));
}

export interface UploadRecord { id: string; name: string; blob: Blob; wCm: number; hCm: number; createdAt: number }

export const putUpload = (u: UploadRecord) => tx<IDBValidKey>("uploads", "readwrite", (s) => s.put(u));
export const getUploads = () => tx<UploadRecord[]>("uploads", "readonly", (s) => s.getAll());
export const deleteUpload = (id: string) => tx<undefined>("uploads", "readwrite", (s) => s.delete(id));
export const putThumb = (id: string, data: string) => tx<IDBValidKey>("thumbs", "readwrite", (s) => s.put(data, id));
export const getThumb = (id: string) => tx<string | undefined>("thumbs", "readonly", (s) => s.get(id));
export const deleteThumb = (id: string) => tx<undefined>("thumbs", "readwrite", (s) => s.delete(id));

export interface SavedDesign {
  id: string;
  name: string;
  sceneId: string;
  rugId: string;
  rugName: string;
  placement: RugPlacement;
  createdAt: number;
}

const KEY = "room-studio:designs";
export function loadDesigns(): SavedDesign[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function storeDesigns(d: SavedDesign[]) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
