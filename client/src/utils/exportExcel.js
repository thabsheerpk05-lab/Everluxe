import * as XLSX from "xlsx";

const DEFAULT_HEADER = "WADINOOR DAILY UMRAH SERVICE";

const baseBorder = {
  top: { style: "thin", color: { rgb: "D1D5DB" } },
  bottom: { style: "thin", color: { rgb: "D1D5DB" } },
  left: { style: "thin", color: { rgb: "D1D5DB" } },
  right: { style: "thin", color: { rgb: "D1D5DB" } }
};

const headerFill = { patternType: "solid", fgColor: { rgb: "F3F4F6" } };
const zebraFill = { patternType: "solid", fgColor: { rgb: "FAFAFA" } };

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function exportToExcel(filename, headers, rows, options = {}) {
  const headerTitle = options.headerTitle || DEFAULT_HEADER;
  const reportTitle = options.title || "";
  const generatedAt = options.generatedAt || new Date();
  const meta = options.meta || [];
  const alignments = options.alignments || headers.map((_, idx) => (idx === 0 ? "center" : "left"));
  const columnWidths = options.columnWidths || headers.map(() => ({ wch: 18 }));
  const boldRows = options.boldRows || [];

  const sheetRows = [];
  sheetRows.push([headerTitle]);
  if (reportTitle) sheetRows.push([reportTitle]);
  sheetRows.push([`Generated: ${formatDate(generatedAt)}`]);
  meta.forEach((line) => sheetRows.push([line]));
  sheetRows.push([]);
  const headerRowIndex = sheetRows.length;
  sheetRows.push(headers);
  rows.forEach((row) => sheetRows.push(row));

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

  const colCount = headers.length;
  const merges = [];
  const mergeRow = (rowIndex) => {
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
  };
  mergeRow(0);
  if (reportTitle) mergeRow(1);
  mergeRow(reportTitle ? 2 : 1);
  meta.forEach((_, idx) => mergeRow((reportTitle ? 3 : 2) + idx));
  worksheet["!merges"] = merges;
  worksheet["!cols"] = columnWidths;

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let c = 0; c < colCount; c += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    const cell = worksheet[cellRef];
    if (cell) {
      cell.s = {
        font: { bold: true },
        alignment: { horizontal: alignments[c] || "left", vertical: "center" },
        fill: headerFill,
        border: baseBorder
      };
    }
  }

  for (let r = headerRowIndex + 1; r <= range.e.r; r += 1) {
    const zebra = (r - headerRowIndex) % 2 === 0;
    const isBoldRow = boldRows.includes(r - headerRowIndex - 1);
    for (let c = 0; c < colCount; c += 1) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.s = {
          alignment: { horizontal: alignments[c] || "left", vertical: "center" },
          border: baseBorder,
          fill: zebra ? zebraFill : undefined,
          font: isBoldRow ? { bold: true } : undefined
        };
      }
    }
  }

  const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (headerCell) {
    headerCell.s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }

  if (reportTitle) {
    const titleCell = worksheet[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 11 },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
  }

  XLSX.writeFile(workbook, filename);
}
