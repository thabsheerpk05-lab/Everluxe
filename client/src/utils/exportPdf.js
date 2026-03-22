import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const DEFAULT_HEADER = "WADINOOR DAILY UMRAH SERVICE";

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function exportToPdf(title, headers, rows, options = {}) {
  const headerTitle = options.headerTitle || DEFAULT_HEADER;
  const meta = options.meta || [];
  const alignments = options.alignments || headers.map((_, idx) => (idx === 0 ? "center" : "left"));
  const generatedAt = options.generatedAt || new Date();
  const boldRows = options.boldRows || [];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(headerTitle, pageWidth / 2, 40, { align: "center" });

  if (title) {
    doc.setFontSize(11);
    doc.text(title, pageWidth / 2, 58, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${formatDate(generatedAt)}`, 40, 76);

  let metaY = 92;
  meta.forEach((line) => {
    doc.text(line, 40, metaY);
    metaY += 12;
  });

  const columnStyles = {};
  alignments.forEach((align, idx) => {
    columnStyles[idx] = { halign: align };
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: metaY + 6,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      lineColor: [209, 213, 219],
      lineWidth: 0.6
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: "bold"
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles,
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      if (data.section === "body" && boldRows.includes(data.row.index)) {
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  doc.save(`${title || "Report"}.pdf`);
}
