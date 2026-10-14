"use client";

/**
 * Turns a stored file into an address the page can show. Only the service
 * modules in this folder may use it, after they have checked that the
 * signed-in user may open the record the file belongs to.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { getFile } from "./_files";

export type StoredFile =
  /** No file was asked for. */
  | { state: "none" }
  | { state: "loading" }
  /** There is no file behind the record: a seeded sample, or one whose file is gone from this browser. */
  | { state: "missing" }
  /** `url` is an object URL that stays valid while the component is on screen. */
  | { state: "ready"; url: string };

export function useStoredFile(fileId: string | undefined): StoredFile {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    let url: string | undefined;
    getFile(fileId)
      .then((blob) => {
        if (cancelled) return;
        url = blob ? URL.createObjectURL(blob) : undefined;
        setLoaded({ id: fileId, url: url ?? null });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: fileId, url: null });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  // Pages stay mounted when hidden: forget the revoked URL so it is loaded again on return.
  useLayoutEffect(() => {
    return () => setLoaded(null);
  }, [fileId]);

  if (!fileId) return { state: "none" };
  if (!loaded || loaded.id !== fileId) return { state: "loading" };
  return loaded.url ? { state: "ready", url: loaded.url } : { state: "missing" };
}

/** Hands a stored file to the browser as a download. Returns false when there is no file. */
export async function saveStoredFile(fileId: string, fileName: string): Promise<boolean> {
  const blob = await getFile(fileId);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
