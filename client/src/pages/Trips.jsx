import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Select } from "../components/ui/select.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { parsePermissions } from "../utils/permissions.js";
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

const sorters = {
  tripDate: (a, b) => new Date(a.tripDate) - new Date(b.tripDate),
  package: (a, b) => a.package?.packageName.localeCompare(b.package?.packageName || ""),
  route: (a, b) => a.package?.route.localeCompare(b.package?.route || ""),
  travelers: (a, b) => (a.travelerCount ?? a._count?.travelers ?? 0) - (b.travelerCount ?? b._count?.travelers ?? 0)
};

const toDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA");
};

const statusLabels = {
  OPEN: "Open",
  FINISHED: "Finished"
};

const statusOptions = [
  { label: "All statuses", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Finished", value: "FINISHED" }
];

export default function Trips() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const perms = useMemo(() => parsePermissions(user?.permissions), [user?.permissions]);
  const canViewExpenses = user?.role === "ADMIN" || perms.can_view_expenses;
  const canViewCollections = user?.role === "ADMIN";
  const [packages, setPackages] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [ameers, setAmeers] = useState([]);
  const [buses, setBuses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [collections, setCollections] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("tripDate");
  const [sortDir, setSortDir] = useState("desc");
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isTripOpen, setIsTripOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [finishTrip, setFinishTrip] = useState(null);
  const [form, setForm] = useState({
    packageId: "",
    tripDate: "",
    seasonalPrice: "",
    notes: "",
    driverId: "",
    coDriverId: "",
    ameerId: "",
    busId: ""
  });
  const [collectionForm, setCollectionForm] = useState({
    tripId: "",
    ameerId: "",
    amountReceived: "",
    date: ""
  });

  const loadData = async () => {
    const tasks = [
      apiFetch("/packages"),
      apiFetch("/trips"),
      apiFetch("/drivers"),
      apiFetch("/ameers"),
      user?.role === "ADMIN" ? apiFetch("/buses") : Promise.resolve([]),
      user?.role === "ADMIN" ? apiFetch("/collections") : Promise.resolve([]),
      canViewExpenses ? apiFetch("/expenses") : Promise.resolve([])
    ];
    const results = await Promise.all(tasks);
    const [pkgData, tripData, driverData, ameerData, busData, collectionData, expenseData] = results;
    setPackages(pkgData || []);
    setTrips(tripData || []);
    setDrivers(driverData || []);
    setAmeers(ameerData || []);
    setBuses(busData || []);
    setCollections(collectionData || []);
    setExpenses(expenseData || []);
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    setSelectedIds([]);
  }, [trips, page]);

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      setStatusFilter("OPEN");
    }
  }, [user?.role]);

  const effectiveStatusFilter = user?.role === "ADMIN" ? statusFilter : "OPEN";

  const filtered = useMemo(() => {
    const searchValue = search.toLowerCase();
    const dateKey = toDateKey(dateFilter);
    const statusValue = effectiveStatusFilter;
    return trips.filter((trip) => {
      const text = `${trip.package?.packageName} ${trip.package?.route} ${trip.tripDate}`.toLowerCase();
      const matchesSearch = text.includes(searchValue);
      const matchesDate = !dateKey || toDateKey(trip.tripDate) === dateKey;
      const matchesStatus = statusValue === "ALL" || trip.status === statusValue;
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [trips, search, dateFilter, effectiveStatusFilter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [filtered, sortKey, sortDir]);

  const pageSize = 6;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = paged.length > 0 && paged.every((item) => selectedIds.includes(item.id));

  const collectionTotals = useMemo(() => {
    const map = new Map();
    collections.forEach((item) => {
      map.set(item.tripId, (map.get(item.tripId) || 0) + Number(item.amountReceived || 0));
    });
    return map;
  }, [collections]);

  const expenseTotals = useMemo(() => {
    const map = new Map();
    expenses.forEach((expense) => {
      if (!expense.tripId) return;
      map.set(expense.tripId, (map.get(expense.tripId) || 0) + Number(expense.amount || 0));
    });
    return map;
  }, [expenses]);

  const resetTripForm = () => {
    setForm({
      packageId: "",
      tripDate: "",
      seasonalPrice: "",
      notes: "",
      driverId: "",
      coDriverId: "",
      ameerId: "",
      busId: ""
    });
  };

  const resetCollectionForm = () => {
    setCollectionForm({ tripId: "", ameerId: "", amountReceived: "", date: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/trips/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/trips", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetTripForm();
      setEditingId(null);
      toast({ title: editingId ? "Trip updated successfully." : "Trip created successfully.", variant: "success" });
      await loadData();
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const openCreateTrip = () => {
    setEditingId(null);
    resetTripForm();
    setIsTripOpen(true);
  };

  const handleEdit = (trip) => {
    setEditingId(trip.id);
    setForm({
      packageId: trip.packageId,
      tripDate: trip.tripDate?.slice(0, 10),
      seasonalPrice: trip.seasonalPrice,
      notes: trip.notes || "",
      driverId: trip.driverId || "",
      coDriverId: trip.coDriverId || "",
      ameerId: trip.ameerId || "",
      busId: trip.busId || ""
    });
    setIsTripOpen(true);
  };

  const closeTripForm = () => {
    setIsTripOpen(false);
    setEditingId(null);
    resetTripForm();
  };

  const handleFinish = (trip) => {
    if (!trip) return;
    setFinishTrip(trip);
    setIsFinishOpen(true);
  };

  const markTripFinished = async () => {
    if (!finishTrip || finishTrip.status === "FINISHED") return;
    try {
      const updated = await apiFetch(`/trips/${finishTrip.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "FINISHED" })
      });
      await loadData();
      setFinishTrip(updated);
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const closeFinish = () => {
    setIsFinishOpen(false);
    setFinishTrip(null);
  };

  const handleDelete = async (trip) => {
    const confirmed = await confirm({
      title: "Delete this trip?",
      description: "This will permanently remove the trip.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/trips/${trip.id}`, { method: "DELETE" });
    await loadData();
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = await confirm({
      title: `Delete ${selectedIds.length} trips?`,
      description: "This will permanently remove the selected trips.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await Promise.all(selectedIds.map((id) => apiFetch(`/trips/${id}`, { method: "DELETE" })));
    setSelectedIds([]);
    await loadData();
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

  const handleCollectionTripChange = (value) => {
    const trip = trips.find((item) => String(item.id) === String(value));
    setCollectionForm((prev) => ({
      ...prev,
      tripId: value,
      ameerId: trip?.ameerId ? String(trip.ameerId) : ""
    }));
  };

  const handleCollectionSubmit = async (event) => {
    event.preventDefault();
    try {
      await apiFetch("/collections", {
        method: "POST",
        body: JSON.stringify(collectionForm)
      });
      resetCollectionForm();
      toast({ title: "Collection recorded.", variant: "success" });
      await loadData();
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const openCollection = () => {
    resetCollectionForm();
    setIsCollectionOpen(true);
  };

  const closeCollection = () => {
    setIsCollectionOpen(false);
    resetCollectionForm();
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const selectedCollection = finishTrip ? (collectionTotals.get(finishTrip.id) || 0) : 0;
  const selectedExpense = finishTrip ? (expenseTotals.get(finishTrip.id) || 0) : 0;
  const selectedBalance = selectedCollection - selectedExpense;

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Trips</h1>
          <p className="text-sm text-sand-600">Create and manage daily trip schedules.</p>
        </div>
        {user?.role === "ADMIN" ? <Button onClick={openCreateTrip}>Create Trip</Button> : null}
      </div>

      <Modal open={isTripOpen} onClose={closeTripForm}>
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Trip" : "Create Trip"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Package</label>
              <Select
                value={form.packageId}
                onChange={(e) => setForm({ ...form, packageId: e.target.value })}
              >
                <option value="">Select package</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.packageName} - {pkg.route}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Trip Date</label>
              <Input
                type="date"
                value={form.tripDate}
                onChange={(e) => setForm({ ...form, tripDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Driver</label>
              <Select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.driverName} ({driver.phoneNumber || "-"})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Co-driver</label>
              <Select value={form.coDriverId} onChange={(e) => setForm({ ...form, coDriverId: e.target.value })}>
                <option value="">Select co-driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.driverName} ({driver.phoneNumber || "-"})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Ameer</label>
              <Select value={form.ameerId} onChange={(e) => setForm({ ...form, ameerId: e.target.value })}>
                <option value="">Select ameer</option>
                {ameers.map((ameer) => (
                  <option key={ameer.id} value={ameer.id}>
                    {ameer.name} ({ameer.phone || "-"})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Bus</label>
              <Select value={form.busId} onChange={(e) => setForm({ ...form, busId: e.target.value })}>
                <option value="">Select bus</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.busName} ({bus.busNumber})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Seasonal Price (SAR)</label>
              <Input
                type="number"
                value={form.seasonalPrice}
                onChange={(e) => setForm({ ...form, seasonalPrice: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-sand-600">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Trip" : "Create Trip"}</Button>
              <Button type="button" variant="outline" onClick={closeTripForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Modal open={isFinishOpen} onClose={closeFinish}>
        <ModalHeader>
          <ModalTitle>Trip Summary</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {finishTrip ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                <p className="text-xs text-sand-600">Trip</p>
                <p className="text-sm font-semibold">
                  {finishTrip.package?.packageName} - {finishTrip.package?.route}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-sand-600">Date</p>
                    <p className="text-sm font-semibold">{formatDate(finishTrip.tripDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-sand-600">Ameer</p>
                    <p className="text-sm font-semibold">{finishTrip.ameer?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-sand-600">Status</p>
                    <p className="text-sm font-semibold">{statusLabels[finishTrip.status] || finishTrip.status || "-"}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                  <p className="text-xs text-sand-600">Total Collection</p>
                  <p className="text-lg font-semibold">
                    {canViewCollections ? formatCurrency(selectedCollection) : "No access"}
                  </p>
                </div>
                <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                  <p className="text-xs text-sand-600">Total Expense</p>
                  <p className="text-lg font-semibold">
                    {canViewExpenses ? formatCurrency(selectedExpense) : "No access"}
                  </p>
                </div>
                <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                  <p className="text-xs text-sand-600">Balance</p>
                  <p className="text-lg font-semibold">
                    {canViewCollections && canViewExpenses ? formatCurrency(selectedBalance) : "No access"}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {user?.role === "ADMIN" && finishTrip?.status !== "FINISHED" ? (
                  <Button onClick={markTripFinished}>Mark Finished</Button>
                ) : null}
                <Button variant="outline" onClick={closeFinish}>Close</Button>
              </div>
            </div>
          ) : null}
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Trip Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="sm:max-w-xs"
                placeholder="Search trips"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                className="sm:max-w-xs"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              {user?.role === "ADMIN" ? (
                <Select
                  className="sm:max-w-xs"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
            <p className="text-xs text-sand-600">Showing {filtered.length} trips</p>
          </div>

          {selectedIds.length && user?.role === "ADMIN" ? (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
              <span className="text-xs font-semibold text-sand-700">Selected: {selectedIds.length}</span>
              <Button size="sm" variant="outline" onClick={handleBulkDelete}>Delete Selected</Button>
            </div>
          ) : null}

          <Table className="min-w-[1100px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell className="sticky left-0 z-20 w-10 bg-sand-100 border-r border-sand-200">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("tripDate")} className="sticky left-10 z-20 bg-sand-100 border-r border-sand-200 cursor-pointer">Trip Date</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("package")} className="cursor-pointer">Package</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("route")} className="cursor-pointer">Route</TableHeaderCell>
                <TableHeaderCell>Driver</TableHeaderCell>
                <TableHeaderCell>Co-driver</TableHeaderCell>
                <TableHeaderCell>Bus</TableHeaderCell>
                <TableHeaderCell>Ameer</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("travelers")} className="cursor-pointer">Travelers</TableHeaderCell>
                {user?.role === "ADMIN" ? <TableHeaderCell>Collected</TableHeaderCell> : null}
                <TableHeaderCell>Seasonal Price</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell className="sticky left-0 z-10 bg-white border-r border-sand-200 max-w-none">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(trip.id)}
                      onChange={() => toggleSelect(trip.id)}
                    />
                  </TableCell>
                  <TableCell className="sticky left-10 z-10 bg-white border-r border-sand-200">{formatDate(trip.tripDate)}</TableCell>
                  <TableCell>{trip.package?.packageName}</TableCell>
                  <TableCell>{trip.package?.route}</TableCell>
                  <TableCell>{trip.driver?.driverName || "-"}</TableCell>
                  <TableCell>{trip.coDriver?.driverName || "-"}</TableCell>
                  <TableCell>{trip.bus ? `${trip.bus.busName} (${trip.bus.busNumber})` : "-"}</TableCell>
                  <TableCell>{trip.ameer?.name || "-"}</TableCell>
                  <TableCell>{statusLabels[trip.status] || trip.status || "-"}</TableCell>
                  <TableCell>{trip.travelerCount ?? trip._count?.travelers ?? 0}</TableCell>
                  {user?.role === "ADMIN" ? (
                    <TableCell>{formatCurrency(collectionTotals.get(trip.id) || 0)}</TableCell>
                  ) : null}
                  <TableCell>{formatCurrency(trip.seasonalPrice)}</TableCell>
                  <TableCell className="max-w-none">
                    {user?.role === "ADMIN" ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(trip)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(trip)}>Delete</Button>
                        <Button size="sm" variant="outline" onClick={() => handleFinish(trip)}>
                          {trip.status === "FINISHED" ? "Summary" : "Finish"}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleFinish(trip)}>Summary</Button>
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
























