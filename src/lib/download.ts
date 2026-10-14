/** Browser-only helpers for handing the user a file. Call them from event handlers. */

/** Hands the user a file to save. */
export function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Downloads rows as a CSV file. Every cell is quoted, so commas and quotes in the data are safe. */
export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  saveBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
