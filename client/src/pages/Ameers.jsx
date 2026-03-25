import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

const sorters = {
  name: (a, b) => a.name.localeCompare(b.name),
  phone: (a, b) => (a.phone || "").localeCompare(b.phone || "")
};

export default function Ameers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [ameers, setAmeers] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", passportNumber: "", notes: "" });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    const data = await apiFetch("/ameers");
    setAmeers(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sorted = useMemo(() => {
    const items = [...ameers];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [ameers, sortKey, sortDir]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const resetForm = () => {
    setForm({ name: "", phone: "", passportNumber: "", notes: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/ameers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/ameers", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "Ameer updated." : "Ameer added.", variant: "success" });
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

  const handleEdit = (ameer) => {
    setEditingId(ameer.id);
    setForm({ name: ameer.name, phone: ameer.phone || "", passportNumber: ameer.passportNumber || "", notes: ameer.notes || "" });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (ameer) => {
    const confirmed = await confirm({
      title: "Delete this ameer?",
      description: "This will permanently remove the ameer.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/ameers/${ameer.id}`, { method: "DELETE" });
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
          <CardTitle>Ameers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sand-600">Only admins can manage ameers.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Ameers</h1>
          <p className="text-sm text-sand-600">Manage trip group leaders.</p>
        </div>
        <Button onClick={openCreate}>Add Ameer</Button>
      </div>

      <Modal open={isFormOpen} onClose={closeForm}>
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Ameer" : "Add Ameer"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Phone (optional)</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Passport Number</label>
              <Input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-sand-600">Notes</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Ameer" : "Add Ameer"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Ameer List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell onClick={() => toggleSort("name")} className="cursor-pointer">Name</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("phone")} className="cursor-pointer">Phone</TableHeaderCell>
                <TableHeaderCell>Passport</TableHeaderCell>
                <TableHeaderCell>Notes</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((ameer) => (
                <TableRow key={ameer.id}>
                  <TableCell>{ameer.name}</TableCell>
                  <TableCell>{ameer.phone || "-"}</TableCell>
                  <TableCell>{ameer.passportNumber || "-"}</TableCell>
                  <TableCell>{ameer.notes || "-"}</TableCell>
                  <TableCell className="max-w-none">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(ameer)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(ameer)}>Delete</Button>
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




