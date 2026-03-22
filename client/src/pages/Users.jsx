import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Select } from "../components/ui/select.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { parsePermissions } from "../utils/permissions.js";
import { handleEnterToNext } from "../utils/enterToNext.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

const sorters = {
  name: (a, b) => a.name.localeCompare(b.name),
  email: (a, b) => a.email.localeCompare(b.email),
  role: (a, b) => a.role.localeCompare(b.role)
};

const permissionOptions = [
  { key: "can_view_trips", label: "Trips" },
  { key: "can_view_packages", label: "Packages" },
  { key: "can_view_travelers", label: "Travelers" },
  { key: "can_edit_travelers", label: "Edit Travelers" },
  { key: "can_view_expenses", label: "Expenses" },
  { key: "can_edit_expenses", label: "Edit Expenses" },
  { key: "can_view_reports", label: "Reports" },
  { key: "can_manage_payments", label: "Payments" },
  { key: "is_ameer", label: "Ameer Staff" }
];

const defaultPermissions = {
  can_view_trips: true,
  can_view_packages: true,
  can_view_travelers: true,
  can_edit_travelers: true,
  can_view_expenses: true,
  can_edit_expenses: true,
  can_view_reports: true,
  can_manage_payments: true,
  is_ameer: false
};

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [users, setUsers] = useState([]);
  const [ameers, setAmeers] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    permissions: defaultPermissions
  });
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    const [usersData, ameersData] = await Promise.all([
      apiFetch("/users"),
      apiFetch("/ameers")
    ]);
    setUsers(usersData);
    setAmeers(ameersData);
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadData();
    }
  }, [user]);

  const filtered = useMemo(() => {
    return users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort(sorters[sortKey]);
    return sortDir === "asc" ? items : items.reverse();
  }, [filtered, sortKey, sortDir]);

  const pageSize = 8;
  const pageCount = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", role: "STAFF", permissions: defaultPermissions });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      permissions: { ...form.permissions }
    };

    if (payload.role === "STAFF") {
      if (!payload.permissions.ameer_id) {
        toast({ title: "Staff users are created from Ameers.", variant: "error" });
        return;
      }
      payload.permissions.is_ameer = true;
    } else {
      payload.permissions.is_ameer = false;
      delete payload.permissions.ameer_id;
    }

    try {
      if (editingId) {
        await apiFetch(`/users/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
      setEditingId(null);
      toast({ title: editingId ? "User updated." : "User created.", variant: "success" });
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

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      email: item.email,
      password: "",
      role: item.role,
      permissions: { ...defaultPermissions, ...parsePermissions(item.permissions) }
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Delete this user?",
      description: "This will permanently remove the user.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!confirmed) return;
    await apiFetch(`/users/${id}`, { method: "DELETE" });
    await loadData();
  };

  const handlePermissionToggle = async (targetUser, key, value) => {
    const perms = { ...parsePermissions(targetUser.permissions), [key]: value };
    await apiFetch(`/users/${targetUser.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        permissions: perms
      })
    });
    await loadData();
  };

  const handleAmeerAssign = async (targetUser, ameerId) => {
    const perms = { ...parsePermissions(targetUser.permissions), ameer_id: ameerId };
    await apiFetch(`/users/${targetUser.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        permissions: perms
      })
    });
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
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sand-600">Only admins can access user management.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Users</h1>
          <p className="text-sm text-sand-600">Manage staff access and roles.</p>
        </div>
        <Button onClick={openCreate}>Create User</Button>
      </div>

      <Modal open={isFormOpen} onClose={closeForm} size="xl">
        <ModalHeader>
          <ModalTitle>{editingId ? "Edit User" : "Create User"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} onKeyDown={handleEnterToNext}>
            <div>
              <label className="text-xs font-semibold text-sand-600">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Password</label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-sand-600">Role</label>
              <Select
                value={form.role}
                onChange={(e) => {
                  const nextRole = e.target.value;
                  setForm((prev) => {
                    const nextPermissions = { ...prev.permissions };
                    if (nextRole === "STAFF") {
                      nextPermissions.is_ameer = true;
                    } else {
                      nextPermissions.is_ameer = false;
                      delete nextPermissions.ameer_id;
                    }
                    return { ...prev, role: nextRole, permissions: nextPermissions };
                  });
                }}
              >
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-sand-600">Permissions</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {permissionOptions.map((perm) => {
                  const isAmeerPerm = perm.key === "is_ameer";
                  const isStaff = form.role === "STAFF";
                  return (
                    <label key={perm.key} className="flex items-center gap-2 text-xs text-sand-700">
                      <input
                        type="checkbox"
                        checked={Boolean(form.permissions[perm.key])}
                        disabled={isStaff && isAmeerPerm}
                        onChange={(e) => setForm({
                          ...form,
                          permissions: { ...form.permissions, [perm.key]: e.target.checked }
                        })}
                      />
                      {perm.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 md:col-span-2 justify-end">
              <Button type="submit">{editingId ? "Update User" : "Create User"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Close</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              className="sm:max-w-xs"
              placeholder="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-xs text-sand-600">{filtered.length} users</p>
          </div>
          <Table className="min-w-[1200px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell onClick={() => toggleSort("name")} className="sticky left-0 z-20 bg-sand-100 border-r border-sand-200 cursor-pointer">Name</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("email")} className="cursor-pointer">Email</TableHeaderCell>
                <TableHeaderCell onClick={() => toggleSort("role")} className="cursor-pointer">Role</TableHeaderCell>
                <TableHeaderCell>Permissions</TableHeaderCell>
                <TableHeaderCell>Ameer</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {paged.map((item) => {
                const perms = { ...defaultPermissions, ...parsePermissions(item.permissions) };
                return (
                  <TableRow key={item.id}>
                    <TableCell className="sticky left-0 z-10 bg-white border-r border-sand-200">{item.name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{item.role}</TableCell>
                    <TableCell className="max-w-none">
                      {item.role === "STAFF" ? (
                        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                          {permissionOptions.map((perm) => {
                            const isAmeerPerm = perm.key === "is_ameer";
                            return (
                              <label key={perm.key} className="flex items-center gap-2 text-xs text-sand-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(perms[perm.key])}
                                  disabled={item.role === "STAFF" && isAmeerPerm}
                                  onChange={(e) => handlePermissionToggle(item, perm.key, e.target.checked)}
                                />
                                {perm.label}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-sand-500">Admin access</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-none">
                      {item.role === "STAFF" ? (
                        <Select value={perms.ameer_id || ""} onChange={(e) => handleAmeerAssign(item, e.target.value)}>
                          <option value="">Select ameer</option>
                          {ameers.map((ameer) => (
                            <option key={ameer.id} value={ameer.id}>
                              {ameer.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-sand-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-none">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>Edit</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item.id)}
                          disabled={item.id === user.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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





