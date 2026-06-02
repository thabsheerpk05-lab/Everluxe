import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Select } from "../components/ui/select.jsx";
import { Input } from "../components/ui/input.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { exportToExcel } from "../utils/exportExcel.js";
import { exportListExpenseIncomePdf, exportToPdf } from "../utils/exportPdf.js";

const reportTypes = [
  { label: "LIST", value: "LIST" },
  { label: "BUS LIST", value: "BUSLIST" },
  { label: "KASHF", value: "KASHF" }
];

const expenseCategories = [
  { label: "Bus Expense", value: "BUS" },
  { label: "Room Expense", value: "ROOM" },
  { label: "Jadwal Expense", value: "TRAVEL" },
  { label: "Ameer Expense", value: "GENERAL" },
  { label: "Administrative Expenses", value: "ADMINISTRATIVE" },
  { label: "Miscellaneous Expense", value: "MISCELLANEOUS" }
];

function expenseCategoryLabel(value) {
  if (value === "Jadwal") return "Jadwal Expense";
  if (value === "Ameer") return "Ameer Expense";
  if (value === "Administrative") return "Administrative Expenses";
  if (value === "OTHER") return "Miscellaneous Expense";
  return expenseCategories.find((cat) => cat.value === value)?.label || value || "-";
}

function buildExpenseReport(items) {
  const rows = [];
  const boldRows = [];
  const sortedItems = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
  const categoryOrder = [
    "BUS",
    "ROOM",
    "TRAVEL",
    "GENERAL",
    "ADMINISTRATIVE",
    "MISCELLANEOUS",
    "OTHER"
  ];
  const categories = Array.from(new Set([
    ...categoryOrder,
    ...sortedItems.map((item) => item.category || "OTHER")
  ]));
  let serial = 1;
  let grandTotal = 0;

  categories.forEach((category) => {
    const bucket = sortedItems.filter((item) => String(item.category || "OTHER") === String(category));
    if (!bucket.length) return;
    rows.push(["", expenseCategoryLabel(category).toUpperCase(), "", "", "", ""]);
    boldRows.push(rows.length - 1);
    let bucketTotal = 0;
    bucket.forEach((expense) => {
      const amount = Number(expense.amount || 0);
      bucketTotal += amount;
      grandTotal += amount;
      rows.push([
        serial++,
        formatDate(expense.date),
        expenseCategoryLabel(expense.category),
        expense.description || "-",
        expense.serviceProvider?.providerName || "-",
        amount
      ]);
    });
    rows.push(["", `TOTAL ${expenseCategoryLabel(category).toUpperCase()}`, "", "", "", bucketTotal]);
    boldRows.push(rows.length - 1);
    rows.push(["", "", "", "", "", ""]);
  });

  rows.push(["", "TOTAL EXPENSE", "", "", "", grandTotal]);
  boldRows.push(rows.length - 1);

  return {
    headers: ["S.No", "Date", "Category", "Description", "Service Provider", "Amount"],
    rows,
    boldRows,
    total: grandTotal
  };
}

function formatCompactPdfDate(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return raw || "-";
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12"
  };
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (match && months[match[2]]) {
    return `${match[1].padStart(2, "0")}/${months[match[2]]}/${match[3].slice(-2)}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${String(date.getFullYear()).slice(-2)}`;
}

function compactPassengerPdfReport(report) {
  const headerMap = {
    "S.No": "No",
    "Travel Date": "Date",
    "Passport/Iqama": "ID",
    "Payment Amount": "Amt",
    "Service Provider": "Provider",
    Direction: "Dir"
  };

  return {
    headers: report.headers.map((header) => headerMap[header] || header),
    rows: report.rows.map((row) => row.map((cell, idx) => (idx === 1 ? formatCompactPdfDate(cell) : cell))),
    alignments: ["center", "center", "left", "left", "left", "left", "right", "left", "center"],
    pdfOptions: {
      fontSize: 6.8,
      headFontSize: 7.2,
      cellPadding: 3,
      headCellPadding: 4,
      overflow: "ellipsize",
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 42 },
        2: { cellWidth: 82 },
        3: { cellWidth: 64 },
        4: { cellWidth: 52 },
        5: { cellWidth: 58 },
        6: { cellWidth: 42 },
        7: { cellWidth: 78 },
        8: { cellWidth: 38 }
      }
    }
  };
}

function buildReport(type, passengers) {
  const safe = (value) => (value === null || value === undefined || value === "" ? "-" : value);
  const serviceOrder = (passenger) => {
    if (!passenger.serviceProviderName || passenger.serviceProviderIsMain) return 0;
    const direction = String(passenger.serviceDirection || "").toUpperCase();
    if (direction === "INBOUND") return 1;
    if (direction === "OUTBOUND") return 2;
    return 3;
  };
  const serviceLabel = (passenger) => (
    passenger.serviceProviderName && !passenger.serviceProviderIsMain ? safe(passenger.serviceDirection) : "-"
  );
  if (type === "BUSLIST") {
    const parseMembers = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") return String(item.name || "").trim();
        return "";
      }).filter(Boolean);

      const raw = String(value).trim();
      if (!raw) return [];
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((item) => {
              if (typeof item === "string") return item.trim();
              if (item && typeof item === "object") return String(item.name || "").trim();
              return "";
            }).filter(Boolean);
          }
        } catch {
          return [];
        }
      }
      return raw
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    };

    const sortedByFamily = [...passengers].sort((a, b) => {
      const aType = String(a.travelerType || "").toLowerCase();
      const bType = String(b.travelerType || "").toLowerCase();
      const typeOrder = (type) => (type === "family" ? 0 : type === "bachelor" ? 1 : 2);
      const typeDiff = typeOrder(aType) - typeOrder(bType);
      if (typeDiff !== 0) return typeDiff;
      const aCount = Number(a.familyCount || 0);
      const bCount = Number(b.familyCount || 0);
      if (aType === "family" || bType === "family") {
        if (bCount !== aCount) return bCount - aCount;
      }
      return (a.serial ?? 0) - (b.serial ?? 0);
    });

    const rows = [];
    let rowSerial = 1;
    sortedByFamily.forEach((p) => {
      const typeRaw = String(p.travelerType || "");
      const isFamily = typeRaw.toLowerCase() === "family";
      const members = p.familyMembers?.length
        ? p.familyMembers.map((member) => String(member.name || "").trim()).filter(Boolean)
        : parseMembers(p.coPassengers);
      const familyCount = Number(p.familyCount || members.length || 0);
      const typeLabel = isFamily && familyCount > 0
        ? `FAMILY (${familyCount})`
        : safe(p.travelerType);

      rows.push([
        rowSerial++,
        safe(p.travelerName),
        typeLabel,
        safe(p.phoneNumber)
      ]);

      if (isFamily && members.length) {
        members.forEach((member) => {
          rows.push([
            rowSerial++,
            member,
            "MEMBER",
            ""
          ]);
        });
      }
    });

    return {
      headers: ["No.", "Name", "Type", "Phone number"],
      rows
    };
  }
  if (type === "KASHF") {
    const parseMemberString = (rawValue) => {
      const raw = String(rawValue || "").trim();
      if (!raw) return { name: "", iqama: "" };

      const parenMatch = raw.match(/^(.*)\(([^)]+)\)\s*$/);
      if (parenMatch) {
        return { name: parenMatch[1].trim(), iqama: parenMatch[2].trim() };
      }

      const sepMatch = raw.match(/^(.*?)[\-|/]\s*([A-Za-z0-9]+)\s*$/);
      if (sepMatch && sepMatch[2].length >= 4) {
        return { name: sepMatch[1].trim(), iqama: sepMatch[2].trim() };
      }

      return { name: raw, iqama: "" };
    };

    const normalizeMember = (item) => {
      if (typeof item === "string") return parseMemberString(item);
      if (item && typeof item === "object") {
        const name = String(item.name || "").trim();
        const iqama = String(item.iqamaNumber || item.passportOrIqama || item.iqama || "").trim();
        return { name, iqama };
      }
      return { name: "", iqama: "" };
    };

    const parseMembers = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map(normalizeMember).filter((m) => m.name);

      const raw = String(value).trim();
      if (!raw) return [];
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map(normalizeMember).filter((m) => m.name);
          }
        } catch {
          return [];
        }
      }
      return raw
        .split(",")
        .map((item) => normalizeMember(item))
        .filter((m) => m.name);
    };

    const sortedByFamily = [...passengers].sort((a, b) => {
      const aType = String(a.travelerType || "").toLowerCase();
      const bType = String(b.travelerType || "").toLowerCase();
      const typeOrder = (type) => (type === "family" ? 0 : type === "bachelor" ? 1 : 2);
      const typeDiff = typeOrder(aType) - typeOrder(bType);
      if (typeDiff !== 0) return typeDiff;
      const aCount = Number(a.familyCount || 0);
      const bCount = Number(b.familyCount || 0);
      if (aType === "family" || bType === "family") {
        if (bCount !== aCount) return bCount - aCount;
      }
      return (a.serial ?? 0) - (b.serial ?? 0);
    });

    const rows = [];
    let rowSerial = 1;
    sortedByFamily.forEach((p) => {
      const typeRaw = String(p.travelerType || "");
      const isFamily = typeRaw.toLowerCase() === "family";
      const members = p.familyMembers?.length
        ? p.familyMembers.map((member) => ({ name: member.name, iqama: member.passportOrIqama || "" }))
        : parseMembers(p.coPassengers);

      rows.push([
        rowSerial++,
        safe(p.travelerName),
        "Indian",
        safe(p.passportOrIqama)
      ]);

      if (isFamily && members.length) {
        members.forEach((member) => {
          rows.push([
            rowSerial++,
            safe(member.name),
            "Indian",
            safe(member.iqama)
          ]);
        });
      }
    });

    return {
      headers: ["No.", "Name", "Nationality", "Iqama number"],
      rows
    };
  }
  return {
    headers: ["S.No", "Travel Date", "Name", "Passport/Iqama", "Type", "Phone", "Payment Amount", "Service Provider", "Direction"],
    rows: (() => {
      const sortedByMonth = [...passengers].sort((a, b) => {
        const aDate = a.tripDate ? new Date(a.tripDate).getTime() : 0;
        const bDate = b.tripDate ? new Date(b.tripDate).getTime() : 0;
        if (aDate !== bDate) return aDate - bDate;
        const providerDiff = serviceOrder(a) - serviceOrder(b);
        if (providerDiff !== 0) return providerDiff;
        const providerNameDiff = String(a.serviceProviderName || "").localeCompare(String(b.serviceProviderName || ""));
        if (providerNameDiff !== 0) return providerNameDiff;
        const aType = String(a.travelerType || "").toLowerCase();
        const bType = String(b.travelerType || "").toLowerCase();
        const typeOrder = (type) => (type === "family" ? 0 : type === "bachelor" ? 1 : 2);
        const typeDiff = typeOrder(aType) - typeOrder(bType);
        if (typeDiff !== 0) return typeDiff;
        const aCount = Number(a.familyCount || 0);
        const bCount = Number(b.familyCount || 0);
        if (aType === "family" || bType === "family") {
          if (bCount !== aCount) return bCount - aCount;
        }
        return (a.serial ?? 0) - (b.serial ?? 0);
      });

      const rows = [];
      let rowSerial = 1;
      sortedByMonth.forEach((p) => {
        const typeRaw = String(p.travelerType || "");
        const isFamily = typeRaw.toLowerCase() === "family";
        const members = p.familyMembers?.length
          ? p.familyMembers.map((member) => ({
            name: member.name,
            passportOrIqama: member.passportOrIqama || ""
          }))
          : [];
        const familyCount = Number(p.familyCount || members.length || 0);
        const typeLabel = isFamily && familyCount > 0 ? `FAMILY (${familyCount})` : safe(p.travelerType);
        const amountValue = p.tripStatus === "FINISHED" ? (p.amountPaid ?? 0) : "";

        rows.push([
          rowSerial++,
          safe(p.tripDate ? formatDate(p.tripDate) : ""),
          safe(p.travelerName),
          safe(p.passportOrIqama),
          typeLabel,
          safe(p.phoneNumber),
          safe(amountValue),
          safe(p.serviceProviderName),
          serviceLabel(p)
        ]);

        if (isFamily && members.length) {
          members.forEach((member) => {
            rows.push([
              rowSerial++,
              safe(p.tripDate ? formatDate(p.tripDate) : ""),
              safe(member.name),
              safe(member.passportOrIqama),
              "MEMBER",
              "",
              "",
              safe(p.serviceProviderName),
              serviceLabel(p)
            ]);
          });
        }
      });
      return rows;
    })()
  };
}

function columnAlignments(headers) {
  return headers.map((header, idx) => {
    const key = header.toLowerCase();
    if (idx === 0 || key.includes("status")) return "center";
    if (key.includes("amount")) return "right";
    return "left";
  });
}

function passengerColumnWidths(headers) {
  return headers.map((header) => {
    const key = header.toLowerCase();
    if (key.includes("s.no")) return { wch: 6 };
    if (key.includes("travel date")) return { wch: 16 };
    if (key.includes("phone")) return { wch: 16 };
    if (key.includes("passport")) return { wch: 18 };
    if (key.includes("status")) return { wch: 16 };
    if (key.includes("provider")) return { wch: 20 };
    if (key.includes("direction")) return { wch: 14 };
    if (key.includes("payment")) return { wch: 16 };
    return { wch: 28 };
  });
}

export default function Reports() {
  const [trips, setTrips] = useState([]);
  const [providers, setProviders] = useState([]);
  const [tripId, setTripId] = useState("");
  const [type, setType] = useState("LIST");
  const [passengers, setPassengers] = useState([]);
  const [tripMeta, setTripMeta] = useState(null);
  const currentYear = new Date().getFullYear();
  const [listFilters, setListFilters] = useState({
    year: currentYear,
    month: "ALL",
    dateFrom: "",
    dateTo: ""
  });
  const [reportSummary, setReportSummary] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [unpaidFilters, setUnpaidFilters] = useState({
    tripId: "",
    dateFrom: "",
    dateTo: "",
    serviceProviderId: ""
  });
  const [unpaidReport, setUnpaidReport] = useState({ totalUnpaid: 0, travelers: [] });
  const usesListFilters = type === "LIST";

  useEffect(() => {
    const loadTrips = async () => {
      const [tripData, providerData] = await Promise.all([
        apiFetch("/trips"),
        apiFetch("/providers")
      ]);
      setTrips(tripData);
      setProviders(providerData);
    };
    loadTrips();
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set([currentYear - 1, currentYear, currentYear + 1]);
    trips.forEach((trip) => {
      if (!trip.tripDate) return;
      const tripYear = new Date(trip.tripDate).getFullYear();
      if (!Number.isNaN(tripYear)) years.add(tripYear);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [trips]);

  const monthOptions = useMemo(() => [
    { label: "All months", value: "ALL" },
    ...Array.from({ length: 12 }, (_, idx) => ({
      label: new Date(listFilters.year, idx, 1).toLocaleString("en-GB", { month: "long" }),
      value: String(idx)
    }))
  ], [listFilters.year]);

  const financialRows = useMemo(() => {
    if (!financial) return [];
    return financial.monthly
      .map((row, index) => ({ ...row, index }))
      .filter((row) => {
        if (listFilters.month !== "ALL") return String(row.index) === String(listFilters.month);
        if (!listFilters.dateFrom && !listFilters.dateTo) return true;

        const rangeStart = listFilters.dateFrom
          ? new Date(listFilters.dateFrom)
          : new Date(financial.year, 0, 1);
        const rangeEnd = listFilters.dateTo
          ? new Date(listFilters.dateTo)
          : new Date(financial.year, 11, 31);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setHours(23, 59, 59, 999);

        const monthStart = new Date(financial.year, row.index, 1);
        const monthEnd = new Date(financial.year, row.index + 1, 0, 23, 59, 59, 999);
        return monthEnd >= rangeStart && monthStart <= rangeEnd;
      });
  }, [financial, listFilters.dateFrom, listFilters.dateTo, listFilters.month]);

  const financialTotals = useMemo(() => financialRows.reduce((totals, row) => ({
    revenue: totals.revenue + Number(row.revenue || 0),
    expenses: totals.expenses + Number(row.expenses || 0),
    profit: totals.profit + Number(row.profit || 0)
  }), { revenue: 0, expenses: 0, profit: 0 }), [financialRows]);

  
  const handleGenerate = async () => {
    if (usesListFilters) {
      const params = new URLSearchParams();
      params.append("year", String(listFilters.year));
      params.append("month", listFilters.month);
      if (listFilters.dateFrom) params.append("dateFrom", listFilters.dateFrom);
      if (listFilters.dateTo) params.append("dateTo", listFilters.dateTo);
      const [travelerData, expenseData, financialData] = await Promise.all([
        apiFetch(`/reports/travelers?${params.toString()}`),
        apiFetch(`/reports/expenses?${params.toString()}`),
        apiFetch(`/reports/financial?${params.toString()}`)
      ]);
      setPassengers(travelerData.passengers);
      setTripMeta(null);
      setReportSummary(travelerData);
      setExpenses(expenseData.expenses || []);
      setFinancial(financialData);
      return;
    }
    if (!tripId) return;
    const data = await apiFetch(`/reports/trip/${tripId}`);
    setPassengers(data.passengers);
    setTripMeta(data.tripMeta);
    setReportSummary(null);
    setFinancial(null);
    setExpenses([]);
  };

  const handleUnpaid = async () => {
    const params = new URLSearchParams();
    if (unpaidFilters.tripId) params.append("tripId", unpaidFilters.tripId);
    if (unpaidFilters.dateFrom) params.append("dateFrom", unpaidFilters.dateFrom);
    if (unpaidFilters.dateTo) params.append("dateTo", unpaidFilters.dateTo);
    if (unpaidFilters.serviceProviderId) params.append("serviceProviderId", unpaidFilters.serviceProviderId);

    const data = await apiFetch(`/reports/unpaid?${params.toString()}`);
    setUnpaidReport(data);
  };

  const report = useMemo(() => buildReport(type, passengers), [type, passengers]);
  const expenseReport = useMemo(() => buildExpenseReport(expenses), [expenses]);
  const reportTitle = type === "BUSLIST"
    ? "BUS LIST"
    : type;

  const safeText = (value) => (value === null || value === undefined || value === "" ? "-" : value);
  const personLine = (label, name, iqama) => `${label}: ${safeText(name)} | Iqama: ${safeText(iqama)}`;
  const showBusMeta = type === "BUSLIST" || type === "KASHF";
  const reportMeta = tripMeta && type !== "LIST"
    ? showBusMeta
      ? [
          `Bus Number: ${safeText(tripMeta.busNumber)}`,
          `Travel Date: ${formatDate(tripMeta.tripDate)}`,
          `Route: ${safeText(tripMeta.route)}`,
          personLine("Driver", tripMeta.driverName, tripMeta.driverIqama),
          personLine("Co-driver", tripMeta.coDriverName, tripMeta.coDriverIqama),
          personLine("Ameer", tripMeta.ameerName, tripMeta.ameerIqama)
        ]
      : [
          `Trip Date: ${formatDate(tripMeta.tripDate)}`,
          `Route: ${safeText(tripMeta.route)}`,
          `Driver/Ameer Name: ${safeText(tripMeta.driverName)} / ${safeText(tripMeta.ameerName)}`
        ]
    : [];
  const listMeta = usesListFilters && reportSummary
    ? [
        `Year: ${reportSummary.year}`,
        `Month: ${
          reportSummary.month === "ALL"
            ? "All months"
            : new Date(reportSummary.year, Number(reportSummary.month), 1).toLocaleString("en-GB", { month: "long" })
        }`,
        `Date From: ${reportSummary.dateFrom ? formatDate(reportSummary.dateFrom) : "-"}`,
        `Date To: ${reportSummary.dateTo ? formatDate(reportSummary.dateTo) : "-"}`,
        `Total Revenue: ${formatCurrency(reportSummary.totalRevenue || 0)}`
      ]
    : [];
  const activeMeta = usesListFilters ? listMeta : reportMeta;

  const handleExportPdf = () => {
    if (type === "LIST") {
      handleListPdf();
      return;
    }
    exportToPdf(`${reportTitle} REPORT`, report.headers, report.rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      meta: activeMeta,
      alignments: columnAlignments(report.headers),
      includeGenerated: false,
      includeMeta: activeMeta.length > 0
    });
  };

  const handleExportExcel = () => {
    exportToExcel(`${reportTitle}-Report.xlsx`, report.headers, report.rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      title: `${reportTitle} REPORT`,
      meta: activeMeta,
      alignments: columnAlignments(report.headers),
      columnWidths: passengerColumnWidths(report.headers),
      includeGenerated: false,
      includeMeta: activeMeta.length > 0
    });
  };

  const formatStatementMonthLabel = (yearValue, monthIndex) => {
    const monthName = new Date(yearValue, monthIndex, 1).toLocaleString("en-GB", { month: "short" });
    return `${monthName}-${String(yearValue).slice(-2)}`;
  };

  const selectedStatementMonths = (monthValue = listFilters.month) => {
    if (!financial) return [];
    const months = financial.monthly.map((row, idx) => {
      const monthStart = new Date(financial.year, idx, 1);
      const monthEnd = new Date(financial.year, idx + 1, 0);
      const rangeStart = listFilters.dateFrom ? new Date(listFilters.dateFrom) : monthStart;
      const rangeEnd = listFilters.dateTo ? new Date(listFilters.dateTo) : monthEnd;
      return {
        year: financial.year,
        monthIndex: idx,
        revenue: row.revenue,
        expenses: row.expenses,
        profit: row.profit,
        internalRevenue: row.internalRevenue,
        externalRevenue: row.externalRevenue,
        expenseByCategory: row.expenseByCategory,
        periodStart: new Date(Math.max(monthStart.getTime(), rangeStart.getTime())),
        periodEnd: new Date(Math.min(monthEnd.getTime(), rangeEnd.getTime()))
      };
    });
    const selected = monthValue === "ALL"
      ? months
      : months.filter((_, idx) => String(idx) === String(monthValue));
    if (monthValue !== "ALL" || (!listFilters.dateFrom && !listFilters.dateTo)) {
      return selected;
    }

    const rangeStart = listFilters.dateFrom
      ? new Date(listFilters.dateFrom)
      : new Date(financial.year, 0, 1);
    const rangeEnd = listFilters.dateTo
      ? new Date(listFilters.dateTo)
      : new Date(financial.year, 11, 31);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    return selected.filter((month) => {
      const monthStart = new Date(month.year, month.monthIndex, 1);
      const monthEnd = new Date(month.year, month.monthIndex + 1, 0, 23, 59, 59, 999);
      return monthEnd >= rangeStart && monthStart <= rangeEnd;
    });
  };

  const financialSuffix = (yearValue = listFilters.year, monthValue = listFilters.month) => (
    monthValue === "ALL"
      ? String(yearValue)
      : `${yearValue}-${formatStatementMonthLabel(yearValue, Number(monthValue))}`
  );

  const handleListPdf = () => {
    const compactPassengerReport = compactPassengerPdfReport(report);
    exportListExpenseIncomePdf(
      `List-Expense-Income-${financialSuffix()}.pdf`,
      {
        title: "PASSENGER LIST REPORT",
        headers: compactPassengerReport.headers,
        rows: compactPassengerReport.rows,
        meta: activeMeta,
        alignments: compactPassengerReport.alignments,
        pdfOptions: compactPassengerReport.pdfOptions
      },
      {
        title: "EXPENSE REPORT",
        headers: expenseReport.headers,
        rows: expenseReport.rows,
        meta: [
          ...activeMeta,
          `Total Expense: ${formatCurrency(expenseReport.total || 0)}`
        ],
        alignments: ["center", "left", "left", "left", "left", "right"],
        boldRows: expenseReport.boldRows
      },
      selectedStatementMonths(),
      {
        passengerHeaderTitle: "WADINOOR DAILY UMRAH SERVICE",
        expenseHeaderTitle: "WADINOOR DAILY UMRAH SERVICE",
        statementHeaderTitle: "WADINOOR",
        statementTitle: "PROFIT AND LOSS A/C",
        includeGenerated: false
      }
    );
  };

  const needsTrip = type === "BUSLIST" || type === "KASHF";
  const canGenerate = needsTrip ? Boolean(tripId) : true;
  const canExport = type === "LIST"
    ? passengers.length > 0 && financialRows.length > 0
    : passengers.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="text-sm text-sand-600">Generate passenger lists and financial summaries.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <label className="text-xs font-semibold text-sand-600">Report Type</label>
              <Select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPassengers([]);
                  setTripMeta(null);
                  setReportSummary(null);
                  setFinancial(null);
                  setExpenses([]);
                }}
              >
                {reportTypes.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            {usesListFilters ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-sand-600">Year</label>
                  <Select
                    value={listFilters.year}
                    onChange={(e) => setListFilters((prev) => ({ ...prev, year: Number(e.target.value) }))}
                  >
                    {yearOptions.map((yearOption) => (
                      <option key={yearOption} value={yearOption}>{yearOption}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-sand-600">Month</label>
                  <Select
                    value={listFilters.month}
                    onChange={(e) => setListFilters((prev) => ({ ...prev, month: e.target.value }))}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-sand-600">Date From</label>
                  <Input
                    type="date"
                    value={listFilters.dateFrom}
                    onChange={(e) => setListFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-sand-600">Date To</label>
                  <Input
                    type="date"
                    value={listFilters.dateTo}
                    onChange={(e) => setListFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-semibold text-sand-600">Trip</label>
                <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  <option value="">Select trip</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.package?.packageName} - {new Date(trip.tripDate).toLocaleDateString("en-GB")}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2 md:col-span-2 lg:col-span-1 lg:justify-end">
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                Generate
              </Button>
              <Button variant="outline" onClick={handleExportPdf} disabled={!canExport}>
                {type === "LIST" ? "Export Full PDF" : "Export PDF"}
              </Button>
              <Button variant="outline" onClick={handleExportExcel} disabled={!canExport}>
                Export Excel
              </Button>
            </div>
          </div>

          {usesListFilters && reportSummary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-sand-500">Passengers</p>
                <p className="text-lg font-semibold">{passengers.length}</p>
              </div>
              <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-sand-500">Revenue Total</p>
                <p className="text-lg font-semibold">{formatCurrency(reportSummary.totalRevenue || 0)}</p>
              </div>
              <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3">
                <p className="text-xs font-semibold text-sand-500">Period</p>
                <p className="text-sm font-semibold">
                  {listMeta.slice(0, 4).map((item) => item.split(": ").slice(1).join(": ")).join(" | ")}
                </p>
              </div>
            </div>
          ) : null}

          {type === "LIST" && financial ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-sand-500">Revenue Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(financialTotals.revenue)}</p>
                </div>
                <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-sand-500">Expense Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(financialTotals.expenses)}</p>
                </div>
                <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3">
                  <p className="text-xs font-semibold text-sand-500">Net Profit / Loss</p>
                  <p className="text-lg font-semibold">{formatCurrency(financialTotals.profit)}</p>
                </div>
              </div>

              <div className="mt-4">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Month</TableHeaderCell>
                      <TableHeaderCell>Revenue</TableHeaderCell>
                      <TableHeaderCell>Expense</TableHeaderCell>
                      <TableHeaderCell>Profit</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <tbody>
                    {financialRows.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{row.month}</TableCell>
                        <TableCell>{formatCurrency(row.revenue)}</TableCell>
                        <TableCell>{formatCurrency(row.expenses)}</TableCell>
                        <TableCell>{formatCurrency(row.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-sand-700">Expense Details</h2>
                  <span className="text-xs text-sand-600">
                    Total: {formatCurrency(expenseReport.total || 0)}
                  </span>
                </div>
                <Table>
                  <TableHead>
                    <TableRow>
                      {expenseReport.headers.map((header) => (
                        <TableHeaderCell key={header}>{header}</TableHeaderCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <tbody>
                    {expenseReport.rows.map((row, rowIdx) => (
                      <TableRow
                        key={rowIdx}
                        className={expenseReport.boldRows.includes(rowIdx) ? "bg-sand-50 font-semibold" : undefined}
                      >
                        {row.map((cell, cellIdx) => (
                          <TableCell
                            key={cellIdx}
                            className={cellIdx === row.length - 1 ? "text-right" : undefined}
                          >
                            {cellIdx === row.length - 1 && typeof cell === "number"
                              ? formatCurrency(cell)
                              : cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          ) : null}

          {tripMeta && type !== "LIST" ? (
            showBusMeta ? (
              <div className="mt-3 space-y-1 text-xs text-sand-600">
                <div>Bus Number: {safeText(tripMeta.busNumber)}</div>
                <div>Travel Date: {formatDate(tripMeta.tripDate)}</div>
                <div>Route: {safeText(tripMeta.route)}</div>
                <div>Driver: {safeText(tripMeta.driverName)} | Iqama: {safeText(tripMeta.driverIqama)}</div>
                <div>Co-driver: {safeText(tripMeta.coDriverName)} | Iqama: {safeText(tripMeta.coDriverIqama)}</div>
                <div>Ameer: {safeText(tripMeta.ameerName)} | Iqama: {safeText(tripMeta.ameerIqama)}</div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-sand-600">
                Trip Date: {formatDate(tripMeta.tripDate)} | Route: {safeText(tripMeta.route)} | Driver/Ameer: {safeText(tripMeta.driverName)} / {safeText(tripMeta.ameerName)}
              </div>
            )
          ) : null}

          <div className="mt-4">
            <Table>
              <TableHead>
                <TableRow>
                  {report.headers.map((header) => (
                    <TableHeaderCell key={header}>{header}</TableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <tbody>
                {report.rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
