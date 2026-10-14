/**
 * FR-7.4: a report document as a PDF or an Excel file. Both are made from the
 * same `ReportDocument`, so they always hold the same rows. Loaded only when
 * someone exports (NFR-2).
 */
import { pdfSafe, reportFileName, sheetName, type ReportDocument } from "@/lib/domain/analytics";
import { saveBlob } from "@/lib/download";

const MARGIN = 40;
/** The app's primary colour, for table headers. */
const HEADER_FILL: [number, number, number] = [23, 52, 107];

function generatedLine(document: ReportDocument) {
  const at = new Date(document.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return `Generated ${at} by ${document.generatedBy}`;
}

/** The report as a landscape A4 PDF: title, filters, then one table after another. */
export async function renderPdf(document: ReportDocument): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setProperties({ title: pdfSafe(document.title), author: pdfSafe(document.generatedBy) });

  let y = MARGIN + 6;
  pdf.setFontSize(16);
  pdf.text(pdfSafe(document.title), MARGIN, y);
  y += 18;
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text(pdfSafe(document.filters.join("  ·  ")), MARGIN, y);
  y += 13;
  pdf.text(pdfSafe(generatedLine(document)), MARGIN, y);
  pdf.setTextColor(0);
  y += 22;

  for (const table of document.tables) {
    if (y > pageHeight - 90) {
      pdf.addPage();
      y = MARGIN;
    }
    pdf.setFontSize(12);
    pdf.text(pdfSafe(table.title), MARGIN, y);
    autoTable(pdf, {
      startY: y + 8,
      margin: { left: MARGIN, right: MARGIN },
      head: [table.columns.map(pdfSafe)],
      body: table.rows.length > 0 ? table.rows.map((row) => row.map((cell) => pdfSafe(String(cell)))) : [["None"]],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: HEADER_FILL },
    });
    const last = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    y = (last?.finalY ?? y) + 28;
  }
  return pdf.output("blob");
}

/** The report as an Excel workbook: one worksheet for each table, each starting with the title and the filters. */
export async function renderExcel(document: ReportDocument): Promise<ArrayBuffer> {
  const loaded = await import("exceljs");
  // The browser build is a single default export; the Node build has named exports.
  const ExcelJS = (loaded as unknown as { default?: typeof loaded }).default ?? loaded;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = document.generatedBy;
  workbook.created = new Date(document.generatedAt);
  const used: string[] = [];

  for (const table of document.tables) {
    const name = sheetName(table.title, used);
    used.push(name);
    const sheet = workbook.addWorksheet(name);
    sheet.addRow([document.title]).font = { bold: true, size: 14 };
    for (const filter of document.filters) sheet.addRow([filter]);
    sheet.addRow([generatedLine(document)]);
    sheet.addRow([]);
    const header = sheet.addRow(table.columns);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17346B" } };
    });
    for (const row of table.rows) sheet.addRow(row);
    // Wide enough for the longest value in each column, within reason.
    table.columns.forEach((column, index) => {
      const longest = Math.max(column.length, ...table.rows.map((row) => String(row[index] ?? "").length));
      sheet.getColumn(index + 1).width = Math.min(60, Math.max(10, longest + 2));
    });
  }
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadPdf(document: ReportDocument) {
  saveBlob(reportFileName(document, "pdf"), await renderPdf(document));
}

export async function downloadExcel(document: ReportDocument) {
  const buffer = await renderExcel(document);
  saveBlob(
    reportFileName(document, "xlsx"),
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
}
