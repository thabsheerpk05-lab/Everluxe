import { useEffect, useMemo, useState } from "react";
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
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

const sorters = {
  name: (a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return a.providerName.localeCompare(b.providerName);
  }
};

export default function Providers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState({ providerName: "", isMain: false });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    const data = await apiFetch("/providers");
    setProviders(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const sorted = useMemo(() => {
    const items = [...providers];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [providers, sortKey, sortDir]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const resetForm = () => {
    setForm({ providerName: "", isMain: false });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/providers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await apiFetch("/providers", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "Provider updated." : "Provider added.", variant: "success" });
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

  const handleEdit = (provider) => {
    setEditingId(provider.id);
    setForm({ providerName: provider.providerName, isMain: Boolean(provider.isMain) });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (provider) => {
    const confirmed = await confirm({
      title: "Delete this provider?",
      description: "This will permanently remove the provider.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/providers/${provider.id}`, { method: "DELETE" });
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
          <CardTitle>Service Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sand-600">Only admins can manage providers.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Service Providers</h1>
          <p className="text-sm text-sand-600">Manage external agencies and Wadinoor defaults.</p>
        </div>
        <Button onClick={openCreate}>Add Provider</Button>
      </div>

      <Modal open={isFormOpen} onClose={closeForm} size="md">
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit Provider" : "Add Provider"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Provider Name</label>
              <Input value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Provider Type</label>
              <Select
                value={form.isMain ? "MAIN" : "OTHER"}
                onChange={(e) => setForm({ ...form, isMain: e.target.value === "MAIN" })}
              >
                <option value="MAIN">Main Provider</option>
                <option value="OTHER">Other Provider</option>
              </Select>
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update Provider" : "Add Provider"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>Provider List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell onClick={() => toggleSort("name")} className="cursor-pointer">Provider</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell>{provider.providerName}</TableCell>
                  <TableCell>
                    <Badge variant={provider.isMain ? "success" : "info"}>
                      {provider.isMain ? "Main" : "Other"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-none">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(provider)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(provider)}>Delete</Button>
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





