import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Select } from "../components/ui/select.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { exportToExcel } from "../utils/exportExcel.js";
import { exportToPdf } from "../utils/exportPdf.js";

const categories = [
  { label: "Bus Expense", value: "BUS" },
  { label: "Room Expense", value: "ROOM" },
  { label: "Jadwal Expense", value: "TRAVEL" },
  { label: "Ameer Expense", value: "GENERAL" },
  { label: "Administrative Expenses", value: "ADMINISTRATIVE" },
  { label: "Other Expense", value: "OTHER" }
];

function categoryLabel(value) {
  if (value === "Jadwal") return "Jadwal Expense";
  if (value === "Ameer") return "Ameer Expense";
  if (value === "Administrative") return "Administrative Expenses";
  return categories.find((cat) => cat.value === value)?.label || value;
}

const sorters = {
  date: (a, b) => new Date(a.date) - new Date(b.date),
  amount: (a, b) => a.amount - b.amount
};

const toDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA");
};

const expenseCategoryBucket = (value) => {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "BUS") return "Bus";
  if (normalized === "ROOM") return "Room";
  return "Miscellaneous";
};

const formatMonthLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { month: "long", year: "numeric" });
};

const buildExpenseReport = (items) => {
  const rows = [];
  const boldRows = [];
  const sortedItems = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
  const categoryOrder = ["Bus", "Room", "Miscellaneous"];
  let serial = 1;
  let grandTotal = 0;

  categoryOrder.forEach((category) => {
    const bucket = sortedItems.filter((item) => expenseCategoryBucket(item.category) === category);
    if (!bucket.length) return;
    rows.push(["", category.toUpperCase(), ""]);
    boldRows.push(rows.length - 1);
    let bucketTotal = 0;
    bucket.forEach((expense) => {
      const amount = Number(expense.amount || 0);
      bucketTotal += amount;
      grandTotal += amount;
      rows.push([
        serial++,
        formatDate(expense.date),
        amount
      ]);
    });
    rows.push(["", `TOTAL ${category.toUpperCase()}`, bucketTotal]);
    boldRows.push(rows.length - 1);
    rows.push(["", "", ""]);
  });

  if (rows.length) {
    rows.push(["", "TOTAL EXPENSE", grandTotal]);
    boldRows.push(rows.length - 1);
  }

  return { rows, boldRows };
};

export default function Expenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [expenses, setExpenses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    date: "",
    tripId: "",
    category: "BUS",
    description: "",
    amount: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [monthFilter, setMonthFilter] = useState("");

  const loadData = async () => {
    const [expenseData, tripData] = await Promise.all([
      apiFetch("/expenses"),
      apiFetch("/trips")
    ]);
    setExpenses(expenseData);
    setTrips(tripData);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [expenses, page]);

  const filtered = useMemo(() => {
    return expenses.filter((expense) => {
      const text = `${expense.description} ${expense.category}`.toLowerCase();
      const searchMatch = text.includes(search.toLowerCase());
      if (!searchMatch) return false;
      if (!monthFilter) return true;
      const monthKey = toDateKey(expense.date).slice(0, 7);
      return monthKey === monthFilter;
    });
  }, [expenses, search, monthFilter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [filtered, sortKey, sortDir]);

  const selectedDateKey = useMemo(() => toDateKey(form.date), [form.date]);
  const dateFilteredTrips = useMemo(() => {
    if (!selectedDateKey) return trips;
    return trips.filter((trip) => toDateKey(trip.tripDate) === selectedDateKey);
  }, [trips, selectedDateKey]);

  const monthOptions = useMemo(() => {
    const monthMap = new Map();
    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      if (Number.isNaN(date.getTime())) return;
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(value)) {
        monthMap.set(value, date);
      }
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, date]) => ({
        value,
        label: date.toLocaleString("en-GB", { month: "long", year: "numeric" })
      }));
  }, [expenses]);

  useEffect(() => {
    if (!form.tripId || !selectedDateKey) return;
    const stillValid = dateFilteredTrips.some((trip) => String(trip.id) === String(form.tripId));
    if (!stillValid) {
      setForm((prev) => ({ ...prev, tripId: "" }));
    }
  }, [dateFilteredTrips, form.tripId, selectedDateKey]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = paged.length > 0 && paged.every((item) => selectedIds.includes(item.id));

  const resetForm = () => {
    setForm({ date: "", tripId: "", category: "BUS", description: "", amount: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/expenses/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/expenses", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "Expense updated." : "Expense recorded.", variant: "success" });
      await loadData();
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      date: expense.date?.slice(0, 10),
      tripId: expense.tripId ? String(expense.tripId) : "",
      category: expense.category,
      description: expense.description,
      amount: expense.amount
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (expense) => {
    const confirmed = await confirm({
      title: "Delete this expense?",
      description: "This will permanently remove the expense.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/expenses/${expense.id}`, { method: "DELETE" });
    await loadData();
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = await confirm({
      title: `Delete ${selectedIds.length} expenses?`,
      description: "This will permanently remove the selected expenses.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await Promise.all(selectedIds.map((id) => apiFetch(`/expenses/${id}`, { method: "DELETE" })));
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

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const canEdit = (expense) => user?.role === "ADMIN" || expense.createdById === user?.id;
  const expenseReport = useMemo(() => buildExpenseReport(filtered), [filtered]);
  const expenseTotals = useMemo(() => {
    const totals = { Bus: 0, Room: 0, Miscellaneous: 0, total: 0 };
    filtered.forEach((expense) => {
      const amount = Number(expense.amount || 0);
      const bucket = expenseCategoryBucket(expense.category);
      totals[bucket] += amount;
      totals.total += amount;
    });
    return totals;
  }, [filtered]);
  const groupedPaged = useMemo(() => {
    const buckets = { Bus: [], Room: [], Miscellaneous: [] };
    paged.forEach((expense) => {
      const bucket = expenseCategoryBucket(expense.category);
      buckets[bucket].push(expense);
    });
    return buckets;
  }, [paged]);

  const handleExportPdf = () => {
    exportToPdf("EXPENSE REPORT", ["S.No", "Date", "Amount"], expenseReport.rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      alignments: ["center", "left", "right"],
      includeGenerated: false,
      boldRows: expenseReport.boldRows
    });
  };

  const handleExportExcel = () => {
    exportToExcel("Expense-Report.xlsx", ["S.No", "Date", "Amount"], expenseReport.rows, {
      headerTitle: "WADINOOR DAILY UMRAH SERVICE",
      title: "EXPENSE REPORT",
      alignments: ["center", "left", "right"],
      columnWidths: [{ wch: 6 }, { wch: 18 }, { wch: 14 }],
      includeGenerated: false,
      boldRows: expenseReport.boldRows
    });
  };

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Expenses</h1>
          <p className="text-sm text-sand-600">Track operational expenses across trips.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={!filtered.length}>
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={!filtered.length}>
            Export Excel
          </Button>
          <Button onClick={openCreate}>Record Expense</Button>
        </div>
      </div>

      <Modal open={isFormOpen} onClose={closeForm}>
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Expense" : "Record Expense"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Date</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Trip (optional)</label>
              <Select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}>
                <option value="">Select trip</option>
                {dateFilteredTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.package?.packageName} ({formatDate(trip.tripDate)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Category</label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Amount (SAR)</label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-sand-600">Description (optional)</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Expense" : "Save Expense"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Expense Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Input
                className="sm:max-w-xs"
                placeholder="Search expenses"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                className="sm:max-w-xs"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="">All months</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-xs text-sand-600">Showing {filtered.length} expenses</p>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-sand-500">Bus</p>
              <p className="text-lg font-semibold">{formatCurrency(expenseTotals.Bus)}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-sand-500">Room</p>
              <p className="text-lg font-semibold">{formatCurrency(expenseTotals.Room)}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-sand-500">Miscellaneous</p>
              <p className="text-lg font-semibold">{formatCurrency(expenseTotals.Miscellaneous)}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3">
              <p className="text-xs font-semibold text-sand-500">Total</p>
              <p className="text-lg font-semibold">{formatCurrency(expenseTotals.total)}</p>
            </div>
          </div>

          {selectedIds.length && user?.role === "ADMIN" ? (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
              <span className="text-xs font-semibold text-sand-700">Selected: {selectedIds.length}</span>
              <Button size="sm" variant="outline" onClick={handleBulkDelete}>Delete Selected</Button>
            </div>
          ) : null}

          <Table className="min-w-[900px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell className="sticky left-0 z-20 w-10 bg-sand-100 border-r border-sand-200">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("date")} className="sticky left-10 z-20 bg-sand-100 border-r border-sand-200 cursor-pointer">Date</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("amount")} className="cursor-pointer">Amount</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {["Bus", "Room", "Miscellaneous"].map((category) => {
                const bucket = groupedPaged[category] || [];
                if (!bucket.length) return null;
                const bucketTotal = bucket.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                return (
                  <Fragment key={category}>
                    <TableRow key={`${category}-header`} className="bg-sand-50">
                      <TableCell colSpan={5} className="text-xs font-semibold text-sand-700">
                        {category.toUpperCase()}
                      </TableCell>
                    </TableRow>
                    {bucket.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="sticky left-0 z-10 bg-white border-r border-sand-200 max-w-none">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(expense.id)}
                            onChange={() => toggleSelect(expense.id)}
                          />
                        </TableCell>
                        <TableCell className="sticky left-10 z-10 bg-white border-r border-sand-200">{formatDate(expense.date)}</TableCell>
                        <TableCell title={expense.description}>{expense.description}</TableCell>
                        <TableCell>{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="max-w-none">
                          {canEdit(expense) ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(expense)}>Edit</Button>
                              {user?.role === "ADMIN" ? (
                                <Button size="sm" variant="outline" onClick={() => handleDelete(expense)}>Delete</Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-sand-500">No access</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow key={`${category}-total`} className="bg-sand-50">
                      <TableCell colSpan={3} className="text-right text-xs font-semibold text-sand-700">
                        TOTAL {category.toUpperCase()}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">{formatCurrency(bucketTotal)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </Fragment>
                );
              })}
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



