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
  name: (a, b) => a.busName.localeCompare(b.busName),
  number: (a, b) => a.busNumber.localeCompare(b.busNumber)
};

export default function Buses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [buses, setBuses] = useState([]);
  const [form, setForm] = useState({ busName: "", busNumber: "" });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    const data = await apiFetch("/buses");
    setBuses(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sorted = useMemo(() => {
    const items = [...buses];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [buses, sortKey, sortDir]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const resetForm = () => {
    setForm({ busName: "", busNumber: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/buses/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/buses", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "Bus updated." : "Bus added.", variant: "success" });
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

  const handleEdit = (bus) => {
    setEditingId(bus.id);
    setForm({ busName: bus.busName, busNumber: bus.busNumber });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (bus) => {
    const confirmed = await confirm({
      title: "Delete this bus?",
      description: "This will permanently remove the bus.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/buses/${bus.id}`, { method: "DELETE" });
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
          <CardTitle>Buses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sand-600">Only admins can manage buses.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Buses</h1>
          <p className="text-sm text-sand-600">Manage bus fleet details.</p>
        </div>
        <Button onClick={openCreate}>Add Bus</Button>
      </div>

      <Modal open={isFormOpen} onClose={closeForm} size="md">
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Bus" : "Add Bus"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Bus Name</label>
              <Input value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Bus Number</label>
              <Input value={form.busNumber} onChange={(e) => setForm({ ...form, busNumber: e.target.value })} />
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Bus" : "Add Bus"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Bus List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell onClick={() => toggleSort("name")} className="cursor-pointer">Bus Name</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("number")} className="cursor-pointer">Bus Number</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((bus) => (
                <TableRow key={bus.id}>
                  <TableCell>{bus.busName}</TableCell>
                  <TableCell>{bus.busNumber}</TableCell>
                  <TableCell className="max-w-none">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(bus)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(bus)}>Delete</Button>
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
