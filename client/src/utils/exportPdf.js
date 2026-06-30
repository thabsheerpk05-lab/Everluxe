import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";

const DEFAULT_HEADER = "WADINOOR DAILY UMRAH SERVICE";
const ARABIC_RE = /[\u0600-\u06FF]/;
const ARABIC_FONT_NAME = "NotoSansArabic";
const ARABIC_FONT_FILE = "NotoSansArabic-Regular.ttf";
let arabicFontBase64Promise;
const autoTable = autoTableModule.default || autoTableModule;

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function pdfText(doc, value, rtl = false) {
  const text = String(value ?? "");
  if (!rtl || !ARABIC_RE.test(text) || typeof doc.processArabic !== "function") return text;
  return doc.processArabic(text);
}

function hasArabic(value) {
  return ARABIC_RE.test(String(value ?? ""));
}

function fontForText(value, rtl = false) {
  return rtl && hasArabic(value) ? ARABIC_FONT_NAME : "helvetica";
}

function setPdfFont(doc, value, rtl = false, style = "normal") {
  doc.setFont(fontForText(value, rtl), style);
}

function pdfCell(doc, value, rtl = false) {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return value;
  return pdfText(doc, value, rtl);
}

async function loadArabicFontBase64() {
  if (!arabicFontBase64Promise) {
    arabicFontBase64Promise = fetch(`/fonts/${ARABIC_FONT_FILE}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load Arabic PDF font: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      });
  }
  return arabicFontBase64Promise;
}

async function registerArabicFont(doc, rtl = false) {
  if (!rtl) return;
  const fontBase64 = await loadArabicFontBase64();
  doc.addFileToVFS(ARABIC_FONT_FILE, fontBase64);
  doc.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, "normal");
  doc.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, "bold");
}

function addTableReport(doc, title, headers, rows, options = {}) {
  const headerTitle = options.headerTitle || DEFAULT_HEADER;
  const meta = options.meta || [];
  const rtl = Boolean(options.rtl);
  const alignments = options.alignments || headers.map((_, idx) => (idx === 0 ? "center" : rtl ? "right" : "left"));
  const includeGenerated = options.includeGenerated !== false;
  const includeMeta = options.includeMeta !== false;
  const generatedAt = options.generatedAt || new Date();
  const boldRows = options.boldRows || [];
  const metaTitle = options.metaTitle || "Report Details";
  const pageLabel = options.pageLabel || "Page";
  const fontSize = options.fontSize || 9;
  const headFontSize = options.headFontSize || 9.5;
  const cellPadding = options.cellPadding ?? 8;
  const headCellPadding = options.headCellPadding ?? 9;
  const overflow = options.overflow || "linebreak";
  const tableHeaders = rtl
    ? headers.map((header) => pdfCell(doc, header, rtl)).reverse()
    : headers.map((header) => pdfCell(doc, header, rtl));
  const tableRows = rows.map((row) => {
    const cells = row.map((cell) => pdfCell(doc, cell, rtl));
    return rtl ? cells.reverse() : cells;
  });
  const tableRawRows = rows.map((row) => (rtl ? [...row].reverse() : row));
  const tableAlignments = rtl ? [...alignments].reverse() : alignments;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = options.marginX ?? 40;
  const contentWidth = pageWidth - marginX * 2;
  const brand = { r: 30, g: 104, b: 86 };

  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.rect(0, 0, pageWidth, 70, "F");

  setPdfFont(doc, headerTitle, rtl, "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.setCharSpace(1.4);
  doc.text(pdfText(doc, headerTitle, rtl), pageWidth / 2, 30, { align: "center" });

  if (title) {
    doc.setFontSize(11);
    doc.setCharSpace(0.6);
    doc.text(pdfText(doc, title, rtl), pageWidth / 2, 52, { align: "center" });
  }

  doc.setCharSpace(0);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metaItems = includeMeta
    ? [
        ...(includeGenerated ? [{ label: "Generated", value: formatDate(generatedAt) }] : []),
        ...meta.map((line) => {
          const idx = line.indexOf(":");
          if (idx === -1) return { label: "Info", value: line };
          return {
            label: line.slice(0, idx).trim(),
            value: line.slice(idx + 1).trim() || "-"
          };
        })
      ]
    : [];

  const metaBoxY = 90;
  const metaBoxPadding = 12;
  const metaTitleHeight = 16;
  const gutter = 18;
  const columnWidth = (contentWidth - gutter) / 2;
  const labelWidth = 88;
  const valueWidth = columnWidth - labelWidth - 8;
  const metaRows = [];
  for (let i = 0; i < metaItems.length; i += 2) {
    metaRows.push([metaItems[i], metaItems[i + 1]].filter(Boolean));
  }

  let tableStartY = metaBoxY;
  if (includeMeta && metaItems.length) {
    const rowHeights = metaRows.map((row) => {
      const lineCounts = row.map((item) =>
        {
          const value = item.value || "-";
          setPdfFont(doc, value, rtl, "normal");
          return doc.splitTextToSize(pdfText(doc, value, rtl), valueWidth).length;
        }
      );
      return Math.max(1, ...lineCounts) * 12;
    });
    const metaBoxHeight =
      metaBoxPadding * 2 +
      metaTitleHeight +
      rowHeights.reduce((sum, h) => sum + h, 0) +
      (metaRows.length - 1) * 4;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, metaBoxY, contentWidth, metaBoxHeight, 7, 7, "FD");
    setPdfFont(doc, metaTitle, rtl, "bold");
    doc.setFontSize(9);
    doc.setTextColor(brand.r, brand.g, brand.b);
    doc.text(pdfText(doc, metaTitle.toUpperCase(), rtl), marginX + 10, metaBoxY + metaBoxPadding + 10);

    let metaY = metaBoxY + metaBoxPadding + metaTitleHeight;
    doc.setFontSize(9);
    metaRows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      row.forEach((item, colIndex) => {
        const colX = marginX + 10 + colIndex * (columnWidth + gutter);
        const labelText = `${(item.label || "Info").toUpperCase()}:`;
        setPdfFont(doc, labelText, rtl, "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(pdfText(doc, labelText, rtl), colX, metaY + 9);
        setPdfFont(doc, item.value || "-", rtl, "normal");
        doc.setTextColor(17, 24, 39);
        const valueLines = doc.splitTextToSize(pdfText(doc, item.value || "-", rtl), valueWidth);
        doc.text(valueLines, colX + labelWidth, metaY + 9);
      });
      metaY += rowHeight + 4;
    });
    tableStartY = metaBoxY + metaBoxHeight + 14;
  } else {
    tableStartY = 90;
  }

  const columnStyles = {};
  tableAlignments.forEach((align, idx) => {
    columnStyles[idx] = { halign: align };
  });
  Object.entries(options.columnStyles || {}).forEach(([idx, style]) => {
    const columnIndex = rtl ? headers.length - 1 - Number(idx) : Number(idx);
    columnStyles[columnIndex] = {
      ...(columnStyles[columnIndex] || {}),
      ...style
    };
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: tableStartY,
    theme: "plain",
    styles: {
      font: rtl ? ARABIC_FONT_NAME : "helvetica",
      fontSize,
      cellPadding,
      lineColor: [224, 230, 234],
      lineWidth: 0.6,
      textColor: [17, 24, 39],
      overflow
    },
    headStyles: {
      fillColor: [30, 104, 86],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: headFontSize,
      lineColor: [30, 104, 86],
      lineWidth: 0.8,
      cellPadding: headCellPadding,
      overflow
    },
    alternateRowStyles: {
      fillColor: [246, 248, 250]
    },
    columnStyles,
    margin: { left: marginX, right: marginX },
    didParseCell: (data) => {
      if (data.section === "body" && boldRows.includes(data.row.index)) {
        data.cell.styles.fontStyle = "bold";
      }
      if (rtl && data.section === "body") {
        const rawValue = tableRawRows[data.row.index]?.[data.column.index];
        if (!hasArabic(rawValue)) {
          data.cell.styles.font = "helvetica";
        }
      }
      if (data.section === "head") {
        data.cell.styles.halign = tableAlignments[data.column.index] || (rtl ? "right" : "left");
      }
    },
    didDrawPage: () => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(124, 136, 150);
      setPdfFont(doc, pageLabel, rtl, "normal");
      doc.text(pdfText(doc, `${pageLabel} ${pageCount}`, rtl), pageWidth - marginX, pageHeight - 18, { align: "right" });
      doc.setTextColor(17, 24, 39);
    }
  });
}

export function exportToPdf(title, headers, rows, options = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const save = () => {
    addTableReport(doc, title, headers, rows, options);
    doc.save(`${title || "Report"}.pdf`);
  };

  if (options.rtl) {
    return registerArabicFont(doc, true).then(save);
  }

  save();
  return undefined;
}

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
    ["", ""],
    ["Cost of Sales", costOfSales],
    ["Bus fare", busFare],
    ["External", externalCost],
    ["Jadwal", jadwal],
    ["Ameer", ameer],
    ["Room rent", roomRent],
    ["Gross Profit", grossProfit],
    ["", ""],
    ["Expenses", ""],
    ["Other expenses", otherExpenses],
    ["Total Expense", otherExpenses],
    ["", ""],
    ["Net Profit / Loss", netProfit],
    ["Net Profit (SAR)", netProfit]
  ];
}

function addIncomeStatementPages(doc, months, options = {}) {
  const headerTitle = options.headerTitle || "WADINOOR";
  const title = options.title || "PROFIT AND LOSS A/C";
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const tableWidth = pageWidth - marginX * 2;
  const headerFill = [143, 170, 220];

  months.forEach((month, index) => {
    if (index > 0) doc.addPage();

    const monthDate = new Date(month.year, month.monthIndex, 1);
    const periodStart = month.periodStart ? new Date(month.periodStart) : new Date(month.year, month.monthIndex, 1);
    const periodEnd = month.periodEnd ? new Date(month.periodEnd) : new Date(month.year, month.monthIndex + 1, 0);
    const periodLabel = `${formatDateDMY(periodStart)} TO ${formatDateDMY(periodEnd)}`;
    const monthLabel = formatMonthLabel(monthDate);

    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text(headerTitle, pageWidth / 2, 60, { align: "center" });
    doc.setFontSize(15);
    doc.text(title, pageWidth / 2, 86, { align: "center" });
    doc.setFontSize(13);
    doc.text(monthLabel, pageWidth / 2, 110, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    doc.text(periodLabel, pageWidth / 2, 132, { align: "center" });

    const statementRows = buildStatementRows({
      revenue: month.revenue,
      expenses: month.expenses,
      profit: month.profit,
      internalRevenue: month.internalRevenue,
      externalRevenue: month.externalRevenue,
      expenseByCategory: month.expenseByCategory
    });
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

    autoTable(doc, {
      head: [["DESCRIPTION", "AMOUNT"]],
      body: statementRows.map((row) => [
        row[0],
        typeof row[1] === "number" ? row[1].toFixed(2) : row[1]
      ]),
      startY: 150,
      theme: "grid",
      styles: {
        font: "times",
        fontSize: 11,
        cellPadding: 6,
        lineColor: [0, 0, 0],
        lineWidth: 0.4,
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: headerFill,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center"
      },
      columnStyles: {
        0: { halign: "left", cellWidth: tableWidth * 0.7 },
        1: { halign: "right", cellWidth: tableWidth * 0.3 }
      },
      margin: { left: marginX, right: marginX },
      didParseCell: (data) => {
        if (data.section === "body") {
          const label = data.row.raw[0];
          if (boldLabels.has(label)) {
            data.cell.styles.fontStyle = "bold";
          }
          if (label === "Net Profit (SAR)") {
            data.cell.styles.fillColor = headerFill;
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      }
    });

    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("Incharge", marginX, pageHeight - 60);
    doc.text("Accountant", marginX + tableWidth * 0.2, pageHeight - 60);
    doc.text("Convenor", marginX + tableWidth * 0.4, pageHeight - 60);
    doc.text("Secretary", marginX + tableWidth * 0.6, pageHeight - 60);
    doc.text("President", marginX + tableWidth * 0.8, pageHeight - 60);
  });
}

export function exportIncomeStatementPdf(filename, months, options = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  addIncomeStatementPages(doc, months, options);

  doc.save(filename);
}

export function exportPassengerIncomeStatementPdf(filename, passengerReport, statementMonths, options = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  addTableReport(doc, passengerReport.title, passengerReport.headers, passengerReport.rows, {
    headerTitle: options.passengerHeaderTitle || DEFAULT_HEADER,
    meta: passengerReport.meta || [],
    alignments: passengerReport.alignments,
    includeGenerated: options.includeGenerated,
    includeMeta: (passengerReport.meta || []).length > 0,
    ...(passengerReport.pdfOptions || {})
  });

  if (statementMonths.length) {
    doc.addPage();
    addIncomeStatementPages(doc, statementMonths, {
      headerTitle: options.statementHeaderTitle || "WADINOOR",
      title: options.statementTitle || "PROFIT AND LOSS A/C"
    });
  }

  doc.save(filename);
}

export function exportListExpenseIncomePdf(filename, passengerReport, expenseReport, statementMonths, options = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: options.orientation || "landscape" });
  addTableReport(doc, passengerReport.title, passengerReport.headers, passengerReport.rows, {
    headerTitle: options.passengerHeaderTitle || DEFAULT_HEADER,
    meta: passengerReport.meta || [],
    alignments: passengerReport.alignments,
    includeGenerated: options.includeGenerated,
    includeMeta: (passengerReport.meta || []).length > 0,
    ...(passengerReport.pdfOptions || {})
  });

  doc.addPage();
  addTableReport(doc, expenseReport.title, expenseReport.headers, expenseReport.rows, {
    headerTitle: options.expenseHeaderTitle || DEFAULT_HEADER,
    meta: expenseReport.meta || [],
    alignments: expenseReport.alignments,
    boldRows: expenseReport.boldRows || [],
    includeGenerated: options.includeGenerated,
    includeMeta: (expenseReport.meta || []).length > 0,
    ...(expenseReport.pdfOptions || {})
  });

  if (statementMonths.length) {
    doc.addPage();
    addIncomeStatementPages(doc, statementMonths, {
      headerTitle: options.statementHeaderTitle || "WADINOOR",
      title: options.statementTitle || "PROFIT AND LOSS A/C"
    });
  }

  doc.save(filename);
}
