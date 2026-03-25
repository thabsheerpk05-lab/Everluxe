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
  name: (a, b) => a.driverName.localeCompare(b.driverName),
  phone: (a, b) => (a.phoneNumber || "").localeCompare(b.phoneNumber || "")
};

export default function Drivers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ driverName: "", phoneNumber: "", passportNumber: "" });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    const data = await apiFetch("/drivers");
    setDrivers(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sorted = useMemo(() => {
    const items = [...drivers];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [drivers, sortKey, sortDir]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const resetForm = () => {
    setForm({ driverName: "", phoneNumber: "", passportNumber: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/drivers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/drivers", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "Driver updated." : "Driver added.", variant: "success" });
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

  const handleEdit = (driver) => {
    setEditingId(driver.id);
    setForm({ driverName: driver.driverName, phoneNumber: driver.phoneNumber || "", passportNumber: driver.passportNumber || "" });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (driver) => {
    const confirmed = await confirm({
      title: "Delete this driver?",
      description: "This will permanently remove the driver.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/drivers/${driver.id}`, { method: "DELETE" });
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

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sand-600">Only admins can manage drivers.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Drivers</h1>
          <p className="text-sm text-sand-600">Assign drivers to trips.</p>
        </div>
        <Button onClick={openCreate}>Add Driver</Button>
      </div>

      <Modal open={isFormOpen} onClose={closeForm} size="md">
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Driver" : "Add Driver"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Driver Name</label>
              <Input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Phone Number (optional)</label>
              <Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Passport Number</label>
              <Input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} />
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Driver" : "Add Driver"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Driver List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell onClick={() => toggleSort("name")} className="cursor-pointer">Driver</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("phone")} className="cursor-pointer">Phone</TableHeaderCell>
                <TableHeaderCell>Passport</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>{driver.driverName}</TableCell>
                  <TableCell>{driver.phoneNumber || "-"}</TableCell>
                  <TableCell>{driver.passportNumber || "-"}</TableCell>
                  <TableCell className="max-w-none">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(driver)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(driver)}>Delete</Button>
                    </div>
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





