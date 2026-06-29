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
const brandFill = { patternType: "solid", fgColor: { rgb: "1E6856" } };
const subBrandFill = { patternType: "solid", fgColor: { rgb: "256E5E" } };
const metaFill = { patternType: "solid", fgColor: { rgb: "F8FAFC" } };
const statementHeaderFill = { patternType: "solid", fgColor: { rgb: "8FAADC" } };

function formatDateDMY(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${year}`;
}

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
  const includeGenerated = options.includeGenerated !== false;
  const includeMeta = options.includeMeta !== false;
  const generatedAt = options.generatedAt || new Date();
  const meta = options.meta || [];
  const metaTitle = options.metaTitle || "Report Details";
  const alignments = options.alignments || headers.map((_, idx) => (idx === 0 ? "center" : "left"));
  const columnWidths = options.columnWidths || headers.map(() => ({ wch: 18 }));
  const boldRows = options.boldRows || [];
  const rtl = Boolean(options.rtl);

  const sheetRows = [];
  sheetRows.push([headerTitle]);
  const titleRowIndex = reportTitle ? sheetRows.length : null;
  if (reportTitle) sheetRows.push([reportTitle]);
  const generatedRowIndex = includeGenerated ? sheetRows.length : null;
  if (includeGenerated) sheetRows.push([`Generated: ${formatDate(generatedAt)}`]);
  const metaTitleRowIndex = includeMeta && meta.length ? sheetRows.length : null;
  if (includeMeta && meta.length) {
    sheetRows.push([metaTitle.toUpperCase()]);
    meta.forEach((line) => sheetRows.push([line]));
  }
  sheetRows.push([]);
  const headerRowIndex = sheetRows.length;
  sheetRows.push(headers);
  rows.forEach((row) => sheetRows.push(row));

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  if (rtl) {
    worksheet["!rtl"] = true;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

  const colCount = headers.length;
  const merges = [];
  const mergeRow = (rowIndex) => {
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
  };
  mergeRow(0);
  if (titleRowIndex !== null) mergeRow(titleRowIndex);
  if (generatedRowIndex !== null) mergeRow(generatedRowIndex);
  if (metaTitleRowIndex !== null) {
    mergeRow(metaTitleRowIndex);
    meta.forEach((_, idx) => mergeRow(metaTitleRowIndex + 1 + idx));
  }
  worksheet["!merges"] = merges;
  worksheet["!cols"] = columnWidths;

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let c = 0; c < colCount; c += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    const cell = worksheet[cellRef];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: alignments[c] || "left", vertical: "center" },
        fill: brandFill,
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
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: brandFill
    };
  }

  if (reportTitle) {
    const titleCell = worksheet[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: subBrandFill
      };
    }
  }

  if (generatedRowIndex !== null) {
    const generatedCell = worksheet[XLSX.utils.encode_cell({ r: generatedRowIndex, c: 0 })];
    if (generatedCell) {
      generatedCell.s = {
        font: { sz: 9, color: { rgb: "475569" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: metaFill
      };
    }
  }

  if (metaTitleRowIndex !== null) {
    const metaTitleRow = metaTitleRowIndex;
    const metaTitleCell = worksheet[XLSX.utils.encode_cell({ r: metaTitleRow, c: 0 })];
    if (metaTitleCell) {
      metaTitleCell.s = {
        font: { bold: true, sz: 9, color: { rgb: "1E6856" } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: metaFill,
        border: baseBorder
      };
    }
    for (let i = 0; i < meta.length; i += 1) {
      const rowIndex = metaTitleRow + 1 + i;
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: 0 });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.s = {
          font: { sz: 9, color: { rgb: "111827" } },
          alignment: { horizontal: "left", vertical: "center" },
          fill: metaFill,
          border: baseBorder
        };
      }
    }
  }

  XLSX.writeFile(workbook, filename);
}

function buildStatementRows({ revenue, internalRevenue, externalRevenue, expenses, expenseByCategory, profit }) {
  const internal = internalRevenue ?? revenue ?? 0;
  const external = externalRevenue ?? 0;
  const totals = Number(revenue || 0);
  const byCategory = expenseByCategory || {};
  const busFare = Number(byCategory.BUS || 0);
  const roomRent = Number(byCategory.ROOM || 0);
  const jadwal = Number(byCategory.TRAVEL || 0);
  const ameer = Number(byCategory.GENERAL || 0);
  const externalCost = Number(byCategory.OTHER || 0);
  const costOfSales = busFare + roomRent + jadwal + ameer + externalCost;
  const totalExpenses = Number(expenses || 0);
  const otherExpenses = Math.max(totalExpenses - costOfSales, 0);
  const grossProfit = totals - costOfSales;
  const netProfit = totals - totalExpenses;

  return [
    ["Income", ""],
    ["Sales", totals],
    ["Total Sales", internal],
    ["Total Sales (from external)", external],
    [""],
    ["Cost of Sales", costOfSales],
    ["Bus fare", busFare],
    ["External", externalCost],
    ["Jadwal", jadwal],
    ["Ameer", ameer],
    ["Room rent", roomRent],
    ["Gross Profit", grossProfit],
    [""],
    ["Expenses", ""],
    ["Other expenses", otherExpenses],
    ["Total Expense", otherExpenses],
    [""],
    ["Net Profit / Loss", netProfit],
    ["Net Profit (SAR)", netProfit]
  ];
}

export function exportIncomeStatementExcel(filename, months, options = {}) {
  const headerTitle = options.headerTitle || "WADINOOR";
  const workbook = XLSX.utils.book_new();
  const columnWidths = options.columnWidths || [{ wch: 46 }, { wch: 18 }];
  const alignments = options.alignments || ["left", "right"];
  const title = options.title || "PROFIT AND LOSS A/C";

  months.forEach((month, index) => {
    const monthDate = new Date(month.year, month.monthIndex, 1);
    const periodStart = new Date(month.year, month.monthIndex, 1);
    const periodEnd = new Date(month.year, month.monthIndex + 1, 0);
    const periodLabel = `${formatDateDMY(periodStart)} TO ${formatDateDMY(periodEnd)}`;
    const monthLabel = formatMonthLabel(monthDate);
    const statementRows = buildStatementRows({
      revenue: month.revenue,
      expenses: month.expenses,
      profit: month.profit,
      internalRevenue: month.internalRevenue,
      externalRevenue: month.externalRevenue,
      expenseByCategory: month.expenseByCategory
    });

    const sheetRows = [
      [headerTitle],
      [title],
      [monthLabel],
      [periodLabel],
      ["DESCRIPTION", "AMOUNT"],
      ...statementRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    const colCount = 2;
    const merges = [];
    const mergeRow = (rowIndex) => {
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
    };
    mergeRow(0);
    mergeRow(1);
    mergeRow(2);
    mergeRow(3);
    worksheet["!merges"] = merges;
    worksheet["!cols"] = columnWidths;

    const headerRowIndex = 4;
    for (let c = 0; c < colCount; c += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.s = {
          font: { bold: true },
          alignment: { horizontal: alignments[c] || "left", vertical: "center" },
          fill: statementHeaderFill,
          border: baseBorder
        };
      }
    }

    const boldLabels = new Set([
      "Income",
      "Sales",
      "Cost of Sales",
      "Gross Profit",
      "Expenses",
      "Total Expense",
      "Net Profit / Loss",
      "Net Profit (SAR)"
    ]);

    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let r = headerRowIndex + 1; r <= range.e.r; r += 1) {
      for (let c = 0; c < colCount; c += 1) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellRef];
        if (cell) {
          const isAmount = c === 1;
          const labelValue = c === 0 ? String(cell.v ?? "") : "";
          const isBold = boldLabels.has(labelValue);
          const isNetRow = labelValue === "Net Profit (SAR)";
          cell.s = {
            alignment: { horizontal: alignments[c] || "left", vertical: "center" },
            border: baseBorder,
            font: isBold ? { bold: true, color: isNetRow ? { rgb: "FFFFFF" } : undefined } : undefined,
            fill: isNetRow ? statementHeaderFill : undefined
          };
          if (isAmount) {
            cell.s.alignment = { horizontal: "right", vertical: "center" };
            cell.z = "#,##0.00";
          }
          if (labelValue === "" && c === 0) {
            cell.s.font = undefined;
          }
        }
      }
    }

    const titleCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    const plCell = worksheet[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (plCell) {
      plCell.s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    const monthCell = worksheet[XLSX.utils.encode_cell({ r: 2, c: 0 })];
    if (monthCell) {
      monthCell.s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    const periodCell = worksheet[XLSX.utils.encode_cell({ r: 3, c: 0 })];
    if (periodCell) {
      periodCell.s = {
        font: { sz: 11 },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, monthLabel || `Month-${index + 1}`);
  });

  XLSX.writeFile(workbook, filename);
}
