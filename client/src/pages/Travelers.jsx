import { useEffect, useMemo, useRef, useState } from "react";
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
const soloTravelerTypes = ["BACHELOR", "LADY"];
const serviceDirections = ["INBOUND", "OUTBOUND"];

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
  const bulkSelectedProvider = findProvider(bulkProviderId);
  const isBulkOtherProvider = Boolean(bulkSelectedProvider && !bulkSelectedProvider.isMain);

  const resetForm = (providerId = defaultProviderId || form.serviceProviderId) => {
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
      serviceDirection: ""
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const wasEditing = Boolean(editingId);

    if (!form.tripId) {
      toast({ title: "Trip selection is required.", variant: "error" });
      return;
    }

    if (isOtherProvider && !form.serviceDirection) {
      toast({ title: "Inbound or outbound is required for other service providers.", variant: "error" });
      return;
    }

    if (soloTravelerTypes.includes(form.travelerType) && !form.phoneNumber) {
      toast({ title: "Phone number is required for bachelor and lady travelers.", variant: "error" });
      return;
    }

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
      serviceDirection: isOtherProvider ? form.serviceDirection : ""
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
        <Button onClick={openCreate}>Add Traveler</Button>
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
                placeholder={form.travelerType === "FAMILY" ? "Optional for family" : "Required for bachelor/lady"}
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
              <label className="text-xs font-semibold text-sand-600">Final Amount (Seasonal)</label>
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




