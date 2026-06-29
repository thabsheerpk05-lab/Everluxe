import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Select } from "../components/ui/select.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { parsePermissions } from "../utils/permissions.js";

const travelerStatuses = ["ACTIVE", "CANCELLED"];
const travelerTypes = [
  { value: "FAMILY", label: "Family" },
  { value: "BACHELOR", label: "Bachelor" },
  { value: "LADY", label: "Lady" }
];
const serviceDirections = ["INBOUND", "OUTBOUND"];
const importColumnAliases = {
  travelerName: ["traveler name", "traveller name", "name", "traveler", "traveller", "passenger name"],
  passportOrIqama: ["passport or iqama", "passport/iqama", "passport iqama", "passport", "iqama", "id number"],
  phoneNumber: ["phone number", "phone", "mobile", "contact", "contact number"],
  travelerType: ["traveler type", "traveller type", "type", "category"],
  familyMembers: ["family members", "members", "family member names", "co passengers", "copassengers"],
  familyPassports: ["family passports", "family passport/iqama", "member passports", "member iqama"],
  providerName: ["provider", "provider name", "service provider", "agency"],
  serviceDirection: ["direction", "service direction", "inbound outbound", "inbound/outbound"],
  customPrice: ["custom price", "final price", "price", "discount amount"],
  extraRoomCharge: ["extra room charge", "extra room", "room charge"]
};

const normalizeImportHeader = (value) => String(value || "")
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/[^\w\s/]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const cleanImportValue = (value) => {
  const text = String(value ?? "").trim();
  return /^'+$/.test(text) ? "" : text;
};

const normalizeLookupValue = (value) => cleanImportValue(value)
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const getImportValue = (row, aliases) => {
  const entries = Object.entries(row || {});
  for (const [key, value] of entries) {
    const normalizedKey = normalizeImportHeader(key);
    if (aliases.includes(normalizedKey)) {
      return cleanImportValue(value);
    }
  }
  return "";
};

const normalizeImportType = (value) => {
  const normalized = String(value || "BACHELOR").trim().toUpperCase();
  const familyMatch = normalized.match(/^F(?:AMILY)?\s*(\d+)?$/);
  if (familyMatch) {
    return "FAMILY";
  }
  if (normalized === "B" || normalized === "BACHELOUR" || normalized === "BACHELOR") return "BACHELOR";
  if (normalized === "L" || normalized === "LADY") return "LADY";
  if (["FAMILY", "BACHELOR", "LADY"].includes(normalized)) return normalized;
  if (normalized === "SINGLE" || normalized === "MALE") return "BACHELOR";
  if (normalized === "FEMALE" || normalized === "WOMAN") return "LADY";
  return normalized;
};

const parseImportType = (value) => {
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase();
  const familyMatch = normalized.match(/^F(?:AMILY)?\s*(\d+)?$/);
  if (familyMatch) {
    return {
      raw,
      travelerType: "FAMILY",
      familyCount: Math.max(Number(familyMatch[1] || 1), 1),
      isContinuation: false
    };
  }
  return {
    raw,
    travelerType: normalizeImportType(raw),
    familyCount: 1,
    isContinuation: !/[A-Z0-9]/i.test(raw)
  };
};

const normalizeImportStatus = (value) => {
  const normalized = String(value || "ACTIVE").trim().toUpperCase();
  return normalized || "ACTIVE";
};

const parseImportAmount = (value) => {
  const normalized = String(value || "").replace(/,/g, "").trim();
  if (!normalized) return "0";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : "0";
};

const normalizeImportDirection = (value) => {
  const normalized = normalizeLookupValue(value).toUpperCase();
  if (normalized === "IN" || normalized === "INBOUND") return "INBOUND";
  if (normalized === "OUT" || normalized === "OUTBOUND") return "OUTBOUND";
  return normalized;
};

const splitImportList = (value) => String(value || "")
  .split(/\r?\n|;|,/)
  .map((item) => item.trim())
  .filter(Boolean);

const parseImportFamilyMembers = (row) => {
  const phoneValue = getImportValue(row, importColumnAliases.phoneNumber);
  const memberSource = getImportValue(row, importColumnAliases.familyMembers) || (phoneValue.includes(",") ? phoneValue : "");
  const memberValues = splitImportList(memberSource);
  const passportValues = splitImportList(getImportValue(row, importColumnAliases.familyPassports));
  return memberValues
    .map((value, index) => {
      const parts = value.split(/\s+\|\s+|\s+-\s+/).map((part) => part.trim()).filter(Boolean);
      const name = parts[0] || value;
      const passportOrIqama = parts[1] || passportValues[index] || "";
      return { name, passportOrIqama };
    })
    .filter((member) => member.name);
};

const parseImportRecords = (rows) => {
  const records = [];
  const sourceRows = rows || [];
  let index = 0;

  while (index < sourceRows.length) {
    const row = sourceRows[index] || {};
    const isBlank = Object.values(row).every((value) => !String(value || "").trim());
    if (isBlank) {
      index += 1;
      continue;
    }

    const typeMeta = parseImportType(getImportValue(row, importColumnAliases.travelerType));
    if (typeMeta.isContinuation) {
      index += 1;
      continue;
    }

    const familyMembers = typeMeta.travelerType === "FAMILY" ? parseImportFamilyMembers(row) : [];
    let consumedRows = 1;
    if (typeMeta.travelerType === "FAMILY" && familyMembers.length < Math.max(typeMeta.familyCount - 1, 0)) {
      const missingMembers = Math.max(typeMeta.familyCount - 1 - familyMembers.length, 0);
      for (let offset = 1; offset <= missingMembers; offset += 1) {
        const memberRow = sourceRows[index + offset] || {};
        const memberName = getImportValue(memberRow, importColumnAliases.travelerName);
        const memberPassport = getImportValue(memberRow, importColumnAliases.passportOrIqama);
        if (memberName || memberPassport) {
          familyMembers.push({ name: memberName, passportOrIqama: memberPassport });
        }
        consumedRows += 1;
      }
    }

    records.push({
      rowNumber: row.__rowNumber || index + 2,
      row,
      typeMeta,
      familyMembers
    });
    index += consumedRows;
  }

  return records;
};

const findImportHeaderIndex = (rows) => (
  rows.findIndex((row) => {
    const headers = (row || []).map(normalizeImportHeader);
    return headers.some((header) => importColumnAliases.travelerName.includes(header))
      && headers.some((header) => importColumnAliases.travelerType.includes(header))
      && headers.some((header) => importColumnAliases.passportOrIqama.includes(header));
  })
);

const mapImportRows = (rows) => {
  const headerIndex = findImportHeaderIndex(rows);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((header, index) => cleanImportValue(header) || `Column ${index + 1}`);
  return rows.slice(headerIndex + 1).map((row, rowIndex) => {
    const record = headers.reduce((nextRecord, header, index) => {
      nextRecord[header] = row[index] ?? "";
      return nextRecord;
    }, {});
    Object.defineProperty(record, "__rowNumber", {
      value: headerIndex + rowIndex + 2,
      enumerable: false
    });
    return record;
  });
};

const importFieldFallbackLabels = {
  travelerName: "NAME",
  passportOrIqama: "IQAMA",
  phoneNumber: "PHONE",
  travelerType: "TYPE",
  providerName: "PROVIDER",
  serviceDirection: "DIRECTION",
  customPrice: "CUSTOM PRICE",
  extraRoomCharge: "EXTRA ROOM CHARGE"
};

const setImportRowValue = (row, field, value) => {
  const aliases = importColumnAliases[field] || [];
  const existingKey = Object.keys(row || {}).find((key) => aliases.includes(normalizeImportHeader(key)));
  const next = { ...(row || {}), [existingKey || importFieldFallbackLabels[field] || field]: value };
  if (row?.__rowNumber) {
    Object.defineProperty(next, "__rowNumber", {
      value: row.__rowNumber,
      enumerable: false
    });
  }
  return next;
};

  const sorters = {
    name: (a, b) => a.travelerName.localeCompare(b.travelerName),
    passport: (a, b) => a.passportOrIqama.localeCompare(b.passportOrIqama),
    amount: (a, b) => a.amountPaid - b.amountPaid,
    family: (a, b) => {
      const aFamily = a.travelerType === "FAMILY";
      const bFamily = b.travelerType === "FAMILY";
      if (aFamily && !bFamily) return -1;
      if (!aFamily && bFamily) return 1;
      if (aFamily && bFamily) {
        return Number(a.familyCount || 1) - Number(b.familyCount || 1);
      }
      return a.travelerName.localeCompare(b.travelerName);
    }
  };
const normalizeFamilyMember = (member) => {
  if (!member || typeof member !== "object") return null;
  const id = member.id ? String(member.id) : "";
  const name = String(member.name || "").trim();
  const passportOrIqama = String(member.passportOrIqama || member.passport || member.iqama || "").trim();
  if (!name && !passportOrIqama) return null;
  return { id, name, passportOrIqama };
};

const makeFamilyId = () => `fm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const parseFamilyMembers = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(normalizeFamilyMember)
      .filter(Boolean)
      .map((member) => ({ ...member, id: member.id || makeFamilyId() }));
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map(normalizeFamilyMember)
        .filter(Boolean)
        .map((member) => ({ ...member, id: member.id || makeFamilyId() }));
    }
  } catch (err) {
    // Fall through to legacy parsing.
  }
  return String(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((passportOrIqama) => ({ id: makeFamilyId(), name: "", passportOrIqama }));
};
export default function Travelers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [searchParams] = useSearchParams();
  const routeTripId = searchParams.get("tripId");
  const perms = parsePermissions(user?.permissions);
  const [trips, setTrips] = useState([]);
  const [providers, setProviders] = useState([]);
  const [travelers, setTravelers] = useState([]);
  const [search, setSearch] = useState("");
  const [tripFilter, setTripFilter] = useState("");
  const [dateFilters, setDateFilters] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("family");
  const [sortDir, setSortDir] = useState("asc");
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("CANCELLED");
  const [bulkProviderId, setBulkProviderId] = useState("");
  const [bulkServiceDirection, setBulkServiceDirection] = useState("INBOUND");
  const travelerNameRef = useRef(null);
  const importFileRef = useRef(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTripId, setImportTripId] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importRawRows, setImportRawRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [form, setForm] = useState({
    travelerName: "",
    passportOrIqama: "",
    phoneNumber: "",
    travelerType: "BACHELOR",
    familyMembers: [],
    tripId: "",
    amountPaid: "0",
    paymentMethod: "Cash",


    extraRoomCharge: "0",
    customPrice: "0",
    status: "ACTIVE",
    serviceProviderId: "",
    serviceDirection: ""
  });

  const loadMeta = async () => {
    const [tripData, providerData] = await Promise.all([
      apiFetch("/trips"),
      apiFetch("/providers")
    ]);
    setTrips(tripData);
    setProviders(providerData);

    const defaultProvider = providerData.find((p) => p.isMain || p.providerName.toLowerCase() === "wadinoor");
    if (!editingId && defaultProvider) {
      setForm((prev) => ({ ...prev, serviceProviderId: String(defaultProvider.id) }));
    }
  };

  const loadTravelers = async () => {
    const params = new URLSearchParams();
    if (tripFilter) params.append("tripId", tripFilter);
    if (dateFilters.from) params.append("dateFrom", dateFilters.from);
    if (dateFilters.to) params.append("dateTo", dateFilters.to);
    if (search) params.append("q", search);
    try {
      const travelerData = await apiFetch(`/travelers?${params.toString()}`);
      setTravelers(travelerData);
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (routeTripId) {
      setTripFilter(routeTripId);
    }
  }, [routeTripId]);

  useEffect(() => {
    loadTravelers();
  }, [search, tripFilter, dateFilters.from, dateFilters.to]);

  useEffect(() => {
    if (form.travelerType !== "FAMILY") {
      setForm((prev) => {
        if (!prev.familyMembers || prev.familyMembers.length === 0) {
          return prev;
        }
        return { ...prev, familyMembers: [] };
      });
    }
  }, [form.travelerType]);

  useEffect(() => {
    setSelectedIds([]);
  }, [travelers, page]);

  const filtered = useMemo(() => travelers, [travelers]);

  const displayCount = useMemo(() => (
    filtered.reduce((sum, traveler) => sum + Number(traveler.familyCount || 1), 0)
  ), [filtered]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [filtered, sortKey, sortDir]);

  const pageSize = 7;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = paged.length > 0 && paged.every((item) => selectedIds.includes(item.id));

  const defaultProviderId = useMemo(() => {
    const found = providers.find((provider) => provider.isMain || provider.providerName.toLowerCase() === "wadinoor");
    return found ? String(found.id) : "";
  }, [providers]);

  const findProvider = (id) => providers.find((provider) => String(provider.id) === String(id));
  const selectedProvider = findProvider(form.serviceProviderId);
  const isOtherProvider = Boolean(selectedProvider && !selectedProvider.isMain);
  const getDirectionForProvider = (providerId, fallback = "") => {
    const provider = findProvider(providerId);
    return provider && !provider.isMain ? fallback || "INBOUND" : "";
  };
  const bulkSelectedProvider = findProvider(bulkProviderId);
  const isBulkOtherProvider = Boolean(bulkSelectedProvider && !bulkSelectedProvider.isMain);

  const resetForm = (providerId = defaultProviderId || form.serviceProviderId) => {
    const nextDirection = getDirectionForProvider(providerId, form.serviceDirection);
    setForm({
      travelerName: "",
      passportOrIqama: "",
      phoneNumber: "",
      travelerType: "BACHELOR",
      familyMembers: [],
      tripId: "",
      amountPaid: "0",
      paymentMethod: "Cash",


      extraRoomCharge: "0",
      customPrice: "0",
      status: "ACTIVE",
      serviceProviderId: providerId || "",
      serviceDirection: nextDirection
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const wasEditing = Boolean(editingId);

    if (!form.tripId) {
      toast({ title: "Trip selection is required.", variant: "error" });
      return;
    }

    const resolvedServiceDirection = isOtherProvider ? form.serviceDirection || "INBOUND" : "";

    const normalizedMembers = form.travelerType === "FAMILY"
      ? (form.familyMembers || []).map(normalizeFamilyMember).filter(Boolean)
      : [];
    const payloadMembers = normalizedMembers.map(({ name, passportOrIqama }) => ({
      name,
      passportOrIqama: passportOrIqama || ""
    }));
    const computedFamilyCount = form.travelerType === "FAMILY" ? 1 + normalizedMembers.length : 1;
    const { familyMembers, ...rest } = form;
    const payload = {
      ...rest,
      familyCount: computedFamilyCount,
      familyMembers: payloadMembers,
      serviceDirection: resolvedServiceDirection
    };

    try {
      if (editingId) {
        await apiFetch(`/travelers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/travelers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      const providerToKeep = form.serviceProviderId || defaultProviderId || "";
      resetForm(providerToKeep);
      setEditingId(null);
      toast({ title: editingId ? "Traveler updated successfully." : "Traveler added successfully.", variant: "success" });
      await loadTravelers();
      if (!wasEditing) {
        requestAnimationFrame(() => travelerNameRef.current?.focus());
      }
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm(defaultProviderId || form.serviceProviderId);
    setIsFormOpen(true);
  };

  const handleEdit = (traveler) => {
    setEditingId(traveler.id);
    setForm({
      travelerName: traveler.travelerName,
      passportOrIqama: traveler.passportOrIqama,
      phoneNumber: traveler.phoneNumber,
      travelerType: traveler.travelerType,
      familyMembers: parseFamilyMembers(traveler.familyMembers || traveler.coPassengers),
      tripId: traveler.tripId,
      amountPaid: traveler.amountPaid,
      paymentMethod: traveler.paymentMethod,


      extraRoomCharge: traveler.extraRoomCharge,
      customPrice: traveler.customPrice,
      status: traveler.status,
      serviceProviderId: traveler.serviceProviderId || "",
      serviceDirection: traveler.serviceDirection || ""
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm(defaultProviderId || form.serviceProviderId);
  };

  const handleDelete = async (traveler) => {
    const confirmed = await confirm({
      title: "Delete this traveler?",
      description: "This will permanently remove the traveler.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/travelers/${traveler.id}`, { method: "DELETE" });
    await loadTravelers();
  };

  const handleCancel = async (traveler) => {
    const confirmed = await confirm({
      title: "Mark this traveler as cancelled?",
      description: "This will update the traveler status to cancelled.",
      confirmLabel: "Mark cancelled",
      tone: "warning"
    });
    if (!confirmed) return;
    try {
      const updated = await apiFetch(`/travelers/${traveler.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "CANCELLED" })
      });
      setTravelers((prev) => prev.map((item) => (
        item.id === traveler.id ? { ...item, status: updated.status || "CANCELLED" } : item
      )));
      toast({ title: "Traveler marked as cancelled.", variant: "success" });
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToDelete = selectedIds;
    const confirmed = await confirm({
      title: `Delete ${idsToDelete.length} travelers?`,
      description: "This will permanently remove the selected travelers.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    setSelectedIds([]);
    await Promise.all(idsToDelete.map((id) => apiFetch(`/travelers/${id}`, { method: "DELETE" })));
    await loadTravelers();
  };

  const handleBulkStatus = async () => {
    if (!selectedIds.length) return;
    const idsToUpdate = selectedIds;
    const confirmed = await confirm({
      title: `Update status for ${idsToUpdate.length} travelers?`,
      description: "This will update the status for all selected travelers.",
      confirmLabel: "Update status",
      tone: "warning"
    });
    if (!confirmed) return;
    setSelectedIds([]);
    await Promise.all(idsToUpdate.map((id) => apiFetch(`/travelers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: bulkStatus })
    })));
    await loadTravelers();
  };

  const handleBulkServiceProvider = async () => {
    if (!selectedIds.length) return;
    if (isBulkOtherProvider && !bulkServiceDirection) {
      toast({ title: "Inbound or outbound is required for other service providers.", variant: "error" });
      return;
    }
    const idsToUpdate = selectedIds;
    const confirmed = await confirm({
      title: `Update provider for ${idsToUpdate.length} travelers?`,
      description: "This will update the service provider for all selected travelers.",
      confirmLabel: "Update provider",
      tone: "warning"
    });
    if (!confirmed) return;
    const payload = {
      serviceProviderId: bulkProviderId,
      serviceDirection: isBulkOtherProvider ? bulkServiceDirection : ""
    };
    setSelectedIds([]);
    await Promise.all(idsToUpdate.map((id) => apiFetch(`/travelers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    })));
    await loadTravelers();
  };

  const openImport = () => {
    setImportTripId(tripFilter || "");
    setImportFileName("");
    setImportRawRows([]);
    if (importFileRef.current) {
      importFileRef.current.value = "";
    }
    setIsImportOpen(true);
  };

  const closeImport = () => {
    if (isImporting) return;
    setIsImportOpen(false);
    setImportFileName("");
    setImportRawRows([]);
    if (importFileRef.current) {
      importFileRef.current.value = "";
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    setImportRawRows([]);
    setImportFileName(file?.name || "");
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      const rows = mapImportRows(sheetRows);
      setImportRawRows(rows);
      if (!rows.length) {
        toast({ title: "No traveler header row found in this file.", variant: "error" });
      }
    } catch (err) {
      setImportFileName("");
      toast({ title: "Could not read this Excel file.", variant: "error" });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paged.some((item) => item.id === id)));
    } else {
      const pageIds = paged.map((item) => item.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const addFamilyMember = () => {
    setForm((prev) => ({
      ...prev,
      familyMembers: [...(prev.familyMembers || []), { id: makeFamilyId(), name: "", passportOrIqama: "" }]
    }));
  };

  const updateFamilyMember = (index, field, value) => {
    setForm((prev) => {
      const next = [...(prev.familyMembers || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, familyMembers: next };
    });
  };

  const removeFamilyMember = (index) => {
    setForm((prev) => {
      const next = [...(prev.familyMembers || [])];
      next.splice(index, 1);
      return { ...prev, familyMembers: next };
    });
  };

  const isAmeerStaff = Boolean(perms?.is_ameer && perms?.ameer_id);
  const canEdit = (traveler) => user?.role === "ADMIN" || traveler.createdById === user?.id || isAmeerStaff;

  const selectedTrip = trips.find((trip) => String(trip.id) === String(form.tripId));
  const tripOptions = editingId
    ? trips
    : trips.filter((trip) => trip.status !== "FINISHED");
  const importTripOptions = trips.filter((trip) => trip.status !== "FINISHED");
  const providerLookup = useMemo(() => (
    new Map(providers.map((provider) => [normalizeLookupValue(provider.providerName), provider]))
  ), [providers]);
  const mainProvider = useMemo(() => (
    providers.find((provider) => provider.isMain) || providers.find((provider) => normalizeLookupValue(provider.providerName) === "wadinoor")
  ), [providers]);
  const importRows = useMemo(() => {
    const seenPassports = new Set();
    return parseImportRecords(importRawRows)
      .map(({ row, rowNumber, typeMeta, familyMembers }) => {
        const travelerName = getImportValue(row, importColumnAliases.travelerName);
        const passportOrIqama = getImportValue(row, importColumnAliases.passportOrIqama);
        const rawPhoneNumber = getImportValue(row, importColumnAliases.phoneNumber);
        const travelerType = typeMeta.travelerType;
        const phoneNumber = travelerType === "FAMILY" && rawPhoneNumber.includes(",") ? "" : rawPhoneNumber;
        const familyCount = travelerType === "FAMILY" ? Math.max(typeMeta.familyCount, 1 + familyMembers.length) : 1;
        const extraRoomCharge = parseImportAmount(getImportValue(row, importColumnAliases.extraRoomCharge));
        const customPrice = parseImportAmount(getImportValue(row, importColumnAliases.customPrice));
        const providerName = getImportValue(row, importColumnAliases.providerName);
        const providerKey = normalizeLookupValue(providerName);
        const resolvedProvider = providerKey ? providerLookup.get(providerKey) : mainProvider;
        const serviceDirection = normalizeImportDirection(getImportValue(row, importColumnAliases.serviceDirection));
        const errors = [];

        if (!importTripId) errors.push("Select a trip");
        if (!travelerName) errors.push("Traveler name is required");
        if (!passportOrIqama) errors.push("Passport/Iqama is required");
        if (!travelerTypes.some((type) => type.value === travelerType)) errors.push("Type must be FAMILY, BACHELOR, or LADY");
        if (travelerType === "FAMILY" && familyMembers.length !== Math.max(familyCount - 1, 0)) {
          errors.push(`Expected ${Math.max(familyCount - 1, 0)} family member rows`);
        }
        if (providerKey && !resolvedProvider) errors.push(`Choose existing provider for "${providerName}"`);
        if (!providerKey && !mainProvider) errors.push("Add a main provider or enter provider names");
        if (resolvedProvider && !resolvedProvider.isMain && !serviceDirection) errors.push("Direction is required for other provider");
        if (serviceDirection && !serviceDirections.includes(serviceDirection)) errors.push("Direction must be INBOUND or OUTBOUND");

        const passportKey = passportOrIqama.toLowerCase();
        if (passportKey) {
          if (seenPassports.has(passportKey)) {
            errors.push("Duplicate passport/Iqama in file");
          }
          seenPassports.add(passportKey);
        }

        return {
          rowNumber,
          travelerName,
          passportOrIqama,
          phoneNumber,
          travelerType,
          familyMembers,
          familyCount,
          extraRoomCharge,
          customPrice,
          providerId: resolvedProvider?.id ? String(resolvedProvider.id) : "",
          providerName: providerName || mainProvider?.providerName || "",
          isProviderMain: Boolean(resolvedProvider?.isMain),
          serviceDirection: resolvedProvider && !resolvedProvider.isMain ? serviceDirection : "",
          errors,
          payload: {
            travelerName,
            passportOrIqama,
            phoneNumber,
            travelerType,
            familyCount,
            familyMembers,
            tripId: importTripId,
            amountPaid: "0",
            paymentMethod: "Cash",
            extraRoomCharge,
            customPrice,
            status: "ACTIVE",
            serviceProviderId: resolvedProvider?.id ? String(resolvedProvider.id) : "",
            serviceDirection: resolvedProvider && !resolvedProvider.isMain ? serviceDirection : ""
          }
        };
      });
  }, [importRawRows, importTripId, providerLookup, mainProvider]);
  const importValidRows = importRows.filter((row) => !row.errors.length);
  const importErrorCount = importRows.reduce((sum, row) => sum + row.errors.length, 0);

  const updateImportRow = (rowNumber, field, value) => {
    setImportRawRows((prev) => prev.map((row) => (
      row.__rowNumber === rowNumber ? setImportRowValue(row, field, value) : row
    )));
  };

  const applyProviderToImportRow = (rowNumber, providerId) => {
    const provider = providers.find((item) => String(item.id) === String(providerId));
    setImportRawRows((prev) => prev.map((row) => {
      if (row.__rowNumber !== rowNumber) return row;
      const withProvider = setImportRowValue(row, "providerName", provider?.providerName || "");
      if (!provider || provider.isMain) {
        return setImportRowValue(withProvider, "serviceDirection", "");
      }
      const direction = getImportValue(row, importColumnAliases.serviceDirection) || "INBOUND";
      return setImportRowValue(withProvider, "serviceDirection", direction);
    }));
  };

  const handleImportSubmit = async () => {
    if (!importRows.length) {
      toast({ title: "Upload an Excel or CSV file first.", variant: "error" });
      return;
    }
    if (!importValidRows.length || importErrorCount) {
      toast({ title: "Fix the highlighted upload issues before importing.", variant: "error" });
      return;
    }

    const confirmed = await confirm({
      title: `Import ${importValidRows.length} travelers?`,
      description: "This will add the previewed rows to the selected trip.",
      confirmLabel: "Import travelers",
      tone: "warning"
    });
    if (!confirmed) return;

    setIsImporting(true);
    const failedRows = [];
    let createdCount = 0;
    for (const row of importValidRows) {
      try {
        await apiFetch("/travelers", {
          method: "POST",
          body: JSON.stringify(row.payload)
        });
        createdCount += 1;
      } catch (err) {
        failedRows.push(`Row ${row.rowNumber}: ${err.message}`);
      }
    }
    setIsImporting(false);
    if (createdCount) {
      await loadTravelers();
    }
    if (failedRows.length) {
      toast({ title: `${createdCount} imported, ${failedRows.length} failed. ${failedRows[0]}`, variant: "error" });
      return;
    }
    toast({ title: `${createdCount} travelers imported successfully.`, variant: "success" });
    closeImport();
  };
  const normalizedFamilyMembers = form.travelerType === "FAMILY"
    ? (form.familyMembers || []).map(normalizeFamilyMember).filter(Boolean)
    : [];
  const computedFamilyCount = form.travelerType === "FAMILY" ? 1 + normalizedFamilyMembers.length : 1;



  const customPrice = Number(form.customPrice || 0);
  const basePrice = customPrice || Number(selectedTrip?.seasonalPrice || 0);
  const memberCount = computedFamilyCount;
  const finalAmount = Math.max(basePrice * memberCount + Number(form.extraRoomCharge || 0), 0);
  
  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Travelers</h1>
          <p className="text-sm text-sand-600">Add travelers and capture payments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openImport}>
            <Upload size={16} className="mr-2" />
            Import Excel
          </Button>
          <Button onClick={openCreate}>Add Traveler</Button>
        </div>
      </div>

      <Modal open={isFormOpen} onClose={closeForm} size="xl">
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Traveler" : "Add Traveler"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Traveler Name</label>
              <Input
                ref={travelerNameRef}
                value={form.travelerName}
                onChange={(e) => setForm({ ...form, travelerName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Passport or Iqama</label>
              <Input
                value={form.passportOrIqama}
                onChange={(e) => setForm({ ...form, passportOrIqama: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Phone Number</label>
              <Input
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Traveler Type</label>
              <Select
                value={form.travelerType}
                onChange={(e) => setForm({ ...form, travelerType: e.target.value })}
              >
                {travelerTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </div>
            {form.travelerType === "FAMILY" ? (
              <>

                <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-sand-600">Family Members (Name + Passport/Iqama)</label>
                    <Button type="button" size="sm" variant="outline" onClick={addFamilyMember}>Add Member</Button>
                  </div>
                  {form.familyMembers.length ? (
                    <div className="mt-2 space-y-2">
                      {form.familyMembers.map((member, index) => (
                        <div key={member.id || `member-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <Input
                            value={member.name || ""}
                            onChange={(e) => updateFamilyMember(index, "name", e.target.value)}
                            placeholder="Member name"
                          />
                          <Input
                            value={member.passportOrIqama || ""}
                            onChange={(e) => updateFamilyMember(index, "passportOrIqama", e.target.value)}
                            placeholder="Passport/Iqama"
                          />
                          <Button type="button" size="sm" variant="outline" onClick={() => removeFamilyMember(index)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-sand-500">No family members added yet.</p>
                  )}
                </div>
              </>
            ) : null}
            <div>
              <label className="text-xs font-semibold text-sand-600">Trip</label>
              <Select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}>
                <option value="">Select trip</option>
                {tripOptions.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.package?.packageName} ({formatDate(trip.tripDate)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Service Provider</label>
              <Select
                value={form.serviceProviderId}
                onChange={(e) => {
                  const nextProvider = findProvider(e.target.value);
                  setForm({
                    ...form,
                    serviceProviderId: e.target.value,
                    serviceDirection: nextProvider && !nextProvider.isMain ? form.serviceDirection || "INBOUND" : ""
                  });
                }}
              >
                <option value="">No provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.providerName}{provider.isMain ? " (Main)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            {isOtherProvider ? (
              <div>
                <label className="text-xs font-semibold text-sand-600">Inbound / Outbound</label>
                <Select
                  value={form.serviceDirection}
                  onChange={(e) => setForm({ ...form, serviceDirection: e.target.value })}
                >
                  {serviceDirections.map((direction) => (
                    <option key={direction} value={direction}>{direction}</option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div>
              <label className="text-xs font-semibold text-sand-600">Custom Price</label>
              <Input
                type="number"
                min="0"
                value={form.customPrice}
                onChange={(e) => setForm({ ...form, customPrice: e.target.value })}
                placeholder="Use trip price if empty"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Extra Room Charge</label>
              <Input
                type="number"
                min="0"
                value={form.extraRoomCharge}
                onChange={(e) => setForm({ ...form, extraRoomCharge: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Final Amount</label>
              <Input value={finalAmount} readOnly />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Status</label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {travelerStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Traveler" : "Add Traveler"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Modal open={isImportOpen} onClose={closeImport} size="xl">
        <ModalHeader>
          <ModalTitle>Import Travelers</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-sand-600">Trip</label>
                <Select value={importTripId} onChange={(e) => setImportTripId(e.target.value)}>
                  <option value="">Select trip</option>
                  {importTripOptions.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.package?.packageName} ({formatDate(trip.tripDate)})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-sand-600">Excel / CSV File</label>
                <Input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile}
                />
              </div>
            </div>

            <div className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs text-sand-700">
              Required columns: Name, Type, Iqama. Optional columns: Phone, Provider, Direction, Custom Price, Extra Room Charge. Empty provider uses the main provider.
            </div>

            {importFileName ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{importFileName}</p>
                <p className="text-xs text-sand-600">
                  {importValidRows.length} ready, {importRows.length - importValidRows.length} need attention
                </p>
              </div>
            ) : null}

            {importRows.length ? (
              <div className="overflow-x-auto rounded-lg border border-sand-200">
                <Table className="min-w-[1300px]">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Row</TableHeaderCell>
                      <TableHeaderCell>Name</TableHeaderCell>
                      <TableHeaderCell>Passport/Iqama</TableHeaderCell>
                      <TableHeaderCell>Phone</TableHeaderCell>
                      <TableHeaderCell>Type</TableHeaderCell>
                      <TableHeaderCell>Family Count</TableHeaderCell>
                      <TableHeaderCell>Provider</TableHeaderCell>
                      <TableHeaderCell>Direction</TableHeaderCell>
                      <TableHeaderCell>Custom Price</TableHeaderCell>
                      <TableHeaderCell>Issues</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <tbody>
                    {importRows.slice(0, 50).map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="min-w-44">
                          <Input
                            value={row.travelerName}
                            onChange={(e) => updateImportRow(row.rowNumber, "travelerName", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="min-w-36">
                          <Input
                            value={row.passportOrIqama}
                            onChange={(e) => updateImportRow(row.rowNumber, "passportOrIqama", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="min-w-32">
                          <Input
                            value={row.phoneNumber}
                            onChange={(e) => updateImportRow(row.rowNumber, "phoneNumber", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="min-w-32">
                          <Select
                            value={row.travelerType}
                            onChange={(e) => updateImportRow(row.rowNumber, "travelerType", e.target.value)}
                          >
                            {travelerTypes.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-28">
                          <Input
                            type="number"
                            min="1"
                            value={row.familyCount}
                            disabled={row.travelerType !== "FAMILY"}
                            onChange={(e) => updateImportRow(row.rowNumber, "travelerType", `F${e.target.value || 1}`)}
                          />
                        </TableCell>
                        <TableCell className="min-w-44">
                          <Select
                            value={row.providerId}
                            onChange={(e) => applyProviderToImportRow(row.rowNumber, e.target.value)}
                          >
                            <option value="">Use main provider</option>
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.providerName}{provider.isMain ? " (Main)" : ""}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-36">
                          <Select
                            value={row.serviceDirection}
                            disabled={!row.providerId || row.isProviderMain}
                            onChange={(e) => updateImportRow(row.rowNumber, "serviceDirection", e.target.value)}
                          >
                            <option value="">-</option>
                            {serviceDirections.map((direction) => (
                              <option key={direction} value={direction}>{direction}</option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-32">
                          <Input
                            type="number"
                            min="0"
                            value={row.customPrice}
                            onChange={(e) => updateImportRow(row.rowNumber, "customPrice", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          {row.errors.length ? (
                            <span className="text-xs font-semibold text-red-600">{row.errors.join(", ")}</span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700">Ready</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
                {importRows.length > 50 ? (
                  <p className="border-t border-sand-200 px-3 py-2 text-xs text-sand-600">
                    Showing first 50 rows of {importRows.length}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeImport} disabled={isImporting}>Close</Button>
              <Button
                type="button"
                onClick={handleImportSubmit}
                disabled={isImporting || !importRows.length || Boolean(importErrorCount)}
              >
                {isImporting ? "Importing..." : `Import ${importValidRows.length} Travelers`}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Traveler List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  placeholder="Search travelers"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-56">
                <label className="text-xs font-semibold text-sand-600">Trip</label>
                <Select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)}>
                  <option value="">All trips</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.package?.packageName} ({formatDate(trip.tripDate)})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <label className="text-xs font-semibold text-sand-600">Trip Date From</label>
                <Input
                  type="date"
                  value={dateFilters.from}
                  onChange={(e) => setDateFilters((prev) => ({ ...prev, from: e.target.value }))}
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="text-xs font-semibold text-sand-600">Trip Date To</label>
                <Input
                  type="date"
                  value={dateFilters.to}
                  onChange={(e) => setDateFilters((prev) => ({ ...prev, to: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-sand-600">Showing {displayCount} travelers</p>
          </div>

          {selectedIds.length ? (
            <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-sand-200 bg-sand-50 px-2 py-2">
              <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-sand-700">
                Selected: {selectedIds.length}
              </span>
              <Select className="h-9 w-32 shrink-0" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                {travelerStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
              <Button className="shrink-0 whitespace-nowrap" size="sm" variant="outline" onClick={handleBulkStatus}>Apply Status</Button>
              <Select
                className="h-9 w-44 shrink-0"
                value={bulkProviderId}
                onChange={(e) => {
                  const nextProvider = findProvider(e.target.value);
                  setBulkProviderId(e.target.value);
                  setBulkServiceDirection(nextProvider && !nextProvider.isMain ? bulkServiceDirection || "INBOUND" : "");
                }}
              >
                <option value="">No provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.providerName}{provider.isMain ? " (Main)" : ""}
                  </option>
                ))}
              </Select>
              {isBulkOtherProvider ? (
                <Select className="h-9 w-36 shrink-0" value={bulkServiceDirection} onChange={(e) => setBulkServiceDirection(e.target.value)}>
                  {serviceDirections.map((direction) => (
                    <option key={direction} value={direction}>{direction}</option>
                  ))}
                </Select>
              ) : null}
              <Button className="shrink-0 whitespace-nowrap" size="sm" variant="outline" onClick={handleBulkServiceProvider}>Apply Provider</Button>
              {user?.role === "ADMIN" ? (
                <Button className="shrink-0 whitespace-nowrap" size="sm" variant="outline" onClick={handleBulkDelete}>Delete Selected</Button>
              ) : null}
            </div>
          ) : null}

          <Table className="min-w-[1200px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell className="sticky left-0 z-20 w-8 min-w-8 bg-sand-100 border-r border-sand-200 px-2 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("name")} className="sticky left-8 z-20 bg-sand-100 border-r border-sand-200 cursor-pointer">Name</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("passport")} className="cursor-pointer">Passport/Iqama</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("family")} className="cursor-pointer">Family Count</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Provider</TableHeaderCell>
                <TableHeaderCell>Direction</TableHeaderCell>
                <TableHeaderCell>Trip</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("amount")} className="cursor-pointer">Payment</TableHeaderCell>
                <TableHeaderCell>Final</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((traveler) => (
                <TableRow key={traveler.id}>
                  <TableCell className="sticky left-0 z-10 w-8 min-w-8 bg-white border-r border-sand-200 max-w-none px-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(traveler.id)}
                      onChange={() => toggleSelect(traveler.id)}
                    />
                  </TableCell>
                  <TableCell className="sticky left-8 z-10 bg-white border-r border-sand-200" title={traveler.travelerName}>
                    <div>{traveler.travelerName}</div>
                    {traveler.travelerType === "FAMILY" && traveler.familyMembers?.length ? (
                      <div className="mt-1 space-y-1 text-xs text-sand-500">
                        {traveler.familyMembers.map((member) => (
                          <div key={member.id}>
                            {member.name}{member.passportOrIqama ? ` - ${member.passportOrIqama}` : ""}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{traveler.passportOrIqama}</TableCell>
                  <TableCell>{traveler.phoneNumber || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={traveler.travelerType === "FAMILY" ? "success" : "info"}>
                      {traveler.travelerType}
                    </Badge>
                  </TableCell>
                  <TableCell>{traveler.travelerType === "FAMILY" ? traveler.familyCount || 1 : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={traveler.status === "CANCELLED" ? "danger" : "success"}>
                      {traveler.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {traveler.serviceProvider?.providerName ? (
                      <div>
                        <div>{traveler.serviceProvider.providerName}</div>
                        {traveler.serviceProvider.isMain ? (
                          <div className="text-xs text-sand-500">Main</div>
                        ) : null}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>{traveler.serviceDirection || "-"}</TableCell>
                  <TableCell>{traveler.trip?.package?.packageName}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>{formatCurrency(traveler.amountPaid)}</div>
                      <div className="text-xs text-sand-500">{traveler.paymentStatus}</div>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(traveler.finalAmount)}</TableCell>
                  <TableCell className="max-w-none">
                    {canEdit(traveler) ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(traveler)}>Edit</Button>
                        {traveler.status !== "CANCELLED" ? (
                          <Button size="sm" variant="outline" onClick={() => handleCancel(traveler)}>Cancel</Button>
                        ) : null}
                        {user?.role === "ADMIN" ? (
                          <Button size="sm" variant="outline" onClick={() => handleDelete(traveler)}>Delete</Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-sand-500">No access</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-sand-600">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}
              disabled={page === pageCount}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




