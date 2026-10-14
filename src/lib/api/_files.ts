"use client";

/**
 * MOCK file storage: uploaded files are kept in the browser's IndexedDB so
 * they survive a reload and can be opened by whoever signs in next on this
 * browser. Only the service modules in this folder may use it.
 *
 * The backend replaces it with object storage: uploads go to the server (or
 * straight to the bucket with a signed URL), are virus-scanned and size-checked
 * there, and are served through URLs the caller is authorized for.
 */
const DATABASE = "lms-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("File storage is not available."));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error("The file could not be stored."));
      transaction.onabort = () => reject(transaction.error ?? new Error("The file could not be stored."));
    });
  } finally {
    database.close();
  }
}

export async function putFile(id: string, file: Blob): Promise<void> {
  await run("readwrite", (store) => store.put(file, id));
}

export async function getFile(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>("readonly", (store) => store.get(id));
}

export async function deleteFile(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}

/** Removes every stored file. Used by "Reset demo data". */
export async function clearFiles(): Promise<void> {
  await run("readwrite", (store) => store.clear());
}
