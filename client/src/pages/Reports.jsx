import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Select } from "../components/ui/select.jsx";
import { Input } from "../components/ui/input.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { formatDate } from "../utils/format.js";
import { exportToExcel } from "../utils/exportExcel.js";
import { exportToPdf } from "../utils/exportPdf.js";

const reportTypes = [
  { label: "LIST", value: "LIST" },
  { label: "BUS LIST", value: "BUSLIST" },
  { label: "KASHF", value: "KASHF" }
];

function buildReport(type, passengers) {
  const safe = (value) => (value === null || value === undefined || value === "" ? "-" : value);
  const sorted = [...passengers].sort((a, b) => (a.serial ?? 0) - (b.serial ?? 0));

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
      if (bType === "family" || aType === "family") {
        if (bCount !== aCount) return bCount - aCount;
      }
      return (a.serial ?? 0) - (b.serial ?? 0);
    });

    const rows = [];
    let rowSerial = 1;
    sortedByFamily.forEach((p) => {
      const typeRaw = String(p.travelerType || "");
      const isFamily = typeRaw.toLowerCase() === "family";
      const members = parseMembers(p.coPassengers);
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

      if (isFamily) {
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
      if (bType === "family" || aType === "family") {
        if (bCount !== aCount) return bCount - aCount;
      }
      return (a.serial ?? 0) - (b.serial ?? 0);
    });

    const rows = [];
    let rowSerial = 1;
    sortedByFamily.forEach((p) => {
      const typeRaw = String(p.travelerType || "");
      const isFamily = typeRaw.toLowerCase() === "family";
      const members = parseMembers(p.coPassengers);

      rows.push([
        rowSerial++,
        safe(p.travelerName),
        "Indian",
        safe(p.passportOrIqama)
      ]);

      if (isFamily) {
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
    headers: ["S.No", "Name", "Passport/Iqama", "Phone", "Payment Status"],
    rows: sorted.map((p, idx) => [
      safe(p.serial ?? idx + 1),
      safe(p.travelerName),
      safe(p.passportOrIqama),
      safe(p.phoneNumber),
      safe(p.paymentStatus)
    ])
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

  const safeText = (value) => (value === null || value === undefined || value === "" ? "-" : value);
  const personLine = (label, name, iqama) => `${label}: ${safeText(name)} | Iqama: ${safeText(iqama)}`;
  const showBusMeta = type === "BUSLIST" || type === "KASHF";
  const reportMeta = tripMeta
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
