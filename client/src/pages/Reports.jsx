import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Select } from "../components/ui/select.jsx";
import { Input } from "../components/ui/input.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { exportToExcel } from "../utils/exportExcel.js";
import { exportToPdf } from "../utils/exportPdf.js";

const reportTypes = [
  { label: "LIST", value: "LIST" },
  { label: "BUS LIST", value: "BUSLIST" },
  { label: "KASHF", value: "KASHF" }
];

function buildReport(type, passengers) {
  if (type === "BUSLIST") {
    return {
      headers: ["S.No", "Name", "Phone", "Payment Status"],
      rows: passengers.map((p) => [p.serial, p.travelerName, p.phoneNumber, p.paymentStatus])
    };
  }
  if (type === "KASHF") {
    return {
      headers: ["S.No", "Name", "Passport/Iqama", "Payment Status"],
      rows: passengers.map((p) => [p.serial, p.travelerName, p.passportOrIqama, p.paymentStatus])
    };
  }
  return {
    headers: ["S.No", "Name", "Passport/Iqama", "Phone", "Payment Status"],
    rows: passengers.map((p) => [p.serial, p.travelerName, p.passportOrIqama, p.phoneNumber, p.paymentStatus])
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
    if (key.includes("phone")) return { wch: 16 };
    if (key.includes("passport")) return { wch: 18 };
    if (key.includes("status")) return { wch: 16 };
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
  const [financial, setFinancial] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [unpaidFilters, setUnpaidFilters] = useState({
    tripId: "",
    dateFrom: "",
    dateTo: "",
    serviceProviderId: ""
  });
  const [unpaidReport, setUnpaidReport] = useState({ totalUnpaid: 0, travelers: [] });

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

  useEffect(() => {
    const loadFinancial = async () => {
      const data = await apiFetch(`/reports/financial?year=${year}`);
      setFinancial(data);
    };
    loadFinancial();
  }, [year]);

  const handleGenerate = async () => {
    if (!tripId) return;
    const data = await apiFetch(`/reports/trip/${tripId}`);
    setPassengers(data.passengers);
    setTripMeta(data.tripMeta);
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
  const reportTitle = type === "BUSLIST" ? "BUS LIST" : type;

  const reportMeta = tripMeta
    ? [
        `Trip Date: ${formatDate(tripMeta.tripDate)}`,
        `Route: ${tripMeta.route || "-"}`,
        `Driver/Ameer Name: ${tripMeta.driverName || "-"} / ${tripMeta.ameerName || "-"}`
      ]
    : [];

  const handleExportPdf = () => {
    exportToPdf(`${reportTitle} REPORT`, report.headers, report.rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      meta: reportMeta,
      alignments: columnAlignments(report.headers),
      generatedAt: new Date()
    });
  };

  const handleExportExcel = () => {
    exportToExcel(`${reportTitle}-Report.xlsx`, report.headers, report.rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      title: `${reportTitle} REPORT`,
      meta: reportMeta,
      alignments: columnAlignments(report.headers),
      columnWidths: passengerColumnWidths(report.headers),
      generatedAt: new Date()
    });
  };

  const exportFinancial = () => {
    if (!financial) return;
    const headers = ["DESCRIPTION", "AMOUNT"];
    const rows = [
      ["Income", ""],
      ["Total Revenue", financial.totalRevenue],
      ["Expenses", ""],
      ["Total Expenses", financial.totalExpenses],
      ["Net Profit", financial.netProfit]
    ];
    exportToExcel(`Profit-Loss-${financial.year}.xlsx`, headers, rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      title: "PROFIT AND LOSS A/C",
      meta: [`Period: 01 Jan ${financial.year} - 31 Dec ${financial.year}`],
      alignments: ["left", "right"],
      columnWidths: [{ wch: 32 }, { wch: 18 }],
      boldRows: [0, 2, 4],
      generatedAt: new Date()
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="text-sm text-sand-600">Generate passenger lists and financial summaries.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Passenger Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
            <div>
              <label className="text-xs font-semibold text-sand-600">Report Type</label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {reportTypes.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-2 md:col-span-2 lg:col-span-1 lg:justify-end">
              <Button onClick={handleGenerate}>Generate</Button>
              <Button variant="outline" onClick={handleExportPdf} disabled={!passengers.length}>
                Export PDF
              </Button>
              <Button variant="outline" onClick={handleExportExcel} disabled={!passengers.length}>
                Export Excel
              </Button>
            </div>
          </div>

          {tripMeta ? (
            <div className="mt-3 text-xs text-sand-600">
              Trip Date: {formatDate(tripMeta.tripDate)} | Route: {tripMeta.route || "-"} | Driver/Ameer: {tripMeta.driverName || "-"} / {tripMeta.ameerName || "-"}
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Unpaid Travelers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-sand-600">Trip</label>
              <Select value={unpaidFilters.tripId} onChange={(e) => setUnpaidFilters({ ...unpaidFilters, tripId: e.target.value })}>
                <option value="">All trips</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.package?.packageName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Date From</label>
              <Input type="date" value={unpaidFilters.dateFrom} onChange={(e) => setUnpaidFilters({ ...unpaidFilters, dateFrom: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Date To</label>
              <Input type="date" value={unpaidFilters.dateTo} onChange={(e) => setUnpaidFilters({ ...unpaidFilters, dateTo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Service Provider</label>
              <Select
                value={unpaidFilters.serviceProviderId}
                onChange={(e) => setUnpaidFilters({ ...unpaidFilters, serviceProviderId: e.target.value })}
              >
                <option value="">All providers</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.providerName}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleUnpaid}>Run Report</Button>
            <span className="text-sm text-red-600">Total Unpaid: {formatCurrency(unpaidReport.totalUnpaid)}</span>
          </div>

          <div className="mt-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Passport/Iqama</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Trip</TableHeaderCell>
                  <TableHeaderCell>Provider</TableHeaderCell>
                  <TableHeaderCell>Paid</TableHeaderCell>
                  <TableHeaderCell>Final</TableHeaderCell>
                  <TableHeaderCell>Unpaid</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {unpaidReport.travelers.map((traveler) => (
                  <TableRow key={traveler.id}>
                    <TableCell>{traveler.travelerName}</TableCell>
                    <TableCell>{traveler.passportOrIqama}</TableCell>
                    <TableCell>{traveler.phoneNumber || "-"}</TableCell>
                    <TableCell>{traveler.trip?.package?.packageName}</TableCell>
                    <TableCell>{traveler.serviceProvider?.providerName}</TableCell>
                    <TableCell>{formatCurrency(traveler.amountPaid)}</TableCell>
                    <TableCell>{formatCurrency(traveler.finalAmount)}</TableCell>
                    <TableCell>{formatCurrency(traveler.unpaidAmount)}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-sand-600">Year</label>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>
            <Button variant="outline" onClick={exportFinancial} disabled={!financial}>
              Export Excel
            </Button>
          </div>
          {financial ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                  <p className="text-xs text-sand-600">Total Revenue</p>
                  <p className="text-xl font-semibold">{formatCurrency(financial.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                  <p className="text-xs text-sand-600">Total Expenses</p>
                  <p className="text-xl font-semibold">{formatCurrency(financial.totalExpenses)}</p>
                </div>
                <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                  <p className="text-xs text-sand-600">Net Profit</p>
                  <p className="text-xl font-semibold">{formatCurrency(financial.netProfit)}</p>
                </div>
              </div>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Month</TableHeaderCell>
                    <TableHeaderCell>Revenue</TableHeaderCell>
                    <TableHeaderCell>Expenses</TableHeaderCell>
                    <TableHeaderCell>Profit</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <tbody>
                  {financial.monthly.map((row) => (
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
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

