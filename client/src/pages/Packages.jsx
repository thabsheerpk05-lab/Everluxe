import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

const sorters = {
  packageName: (a, b) => a.packageName.localeCompare(b.packageName),
  route: (a, b) => a.route.localeCompare(b.route),
  durationDays: (a, b) => a.durationDays - b.durationDays,
  departureDay: (a, b) => a.departureDay.localeCompare(b.departureDay)
};

export default function Packages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [packages, setPackages] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    packageName: "",
    route: "",
    durationDays: "",
    departureDay: "",
    departureTime: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("packageName");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    const data = await apiFetch("/packages");
    setPackages(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return packages.filter((pkg) => {
      const text = `${pkg.packageName} ${pkg.route}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [packages, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [filtered, sortKey, sortDir]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const resetForm = () => {
    setForm({ packageName: "", route: "", durationDays: "", departureDay: "", departureTime: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/packages/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/packages", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "Package updated." : "Package created.", variant: "success" });
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

  const handleEdit = (pkg) => {
    setEditingId(pkg.id);
    setForm({
      packageName: pkg.packageName,
      route: pkg.route,
      durationDays: pkg.durationDays,
      departureDay: pkg.departureDay,
      departureTime: pkg.departureTime
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (pkg) => {
    const confirmed = await confirm({
      title: `Delete package "${pkg.packageName}"?`,
      description: "This will permanently remove the package.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/packages/${pkg.id}`, { method: "DELETE" });
    await loadData();
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Packages</h1>
          <p className="text-sm text-sand-600">Define package templates without pricing.</p>
        </div>
        {user?.role === "ADMIN" ? <Button onClick={openCreate}>Create Package</Button> : null}
      </div>

      <Modal open={isFormOpen} onClose={closeForm}>
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Package" : "Create Package"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Package Name</label>
              <Input
                value={form.packageName}
                onChange={(e) => setForm({ ...form, packageName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Route</label>
              <Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Duration (days)</label>
              <Input
                type="number"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Departure Day</label>
              <Input
                value={form.departureDay}
                onChange={(e) => setForm({ ...form, departureDay: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Departure Time</label>
              <Input
                value={form.departureTime}
                onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
              />
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Package" : "Create Package"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Package List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              className="sm:max-w-xs"
              placeholder="Search packages"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-xs text-sand-600">Showing {filtered.length} packages</p>
          </div>
          <Table className="min-w-[900px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell onClick={() => toggleSort("packageName")} className="sticky left-0 z-20 bg-sand-100 border-r border-sand-200 cursor-pointer">Package</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("route")} className="cursor-pointer">Route</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("durationDays")} className="cursor-pointer">Duration</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("departureDay")} className="cursor-pointer">Departure</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="sticky left-0 z-10 bg-white border-r border-sand-200">{pkg.packageName}</TableCell>
                  <TableCell>{pkg.route}</TableCell>
                  <TableCell>{pkg.durationDays} days</TableCell>
                  <TableCell>{pkg.departureDay}  {pkg.departureTime}</TableCell>
                  <TableCell>
                    {user?.role === "ADMIN" ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(pkg)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(pkg)}>Delete</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-sand-500">View only</span>
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





