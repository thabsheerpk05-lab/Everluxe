import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { parsePermissions } from "../utils/permissions.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "../components/ui/modal.jsx";
import { Select } from "../components/ui/select.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { handleEnterToNext } from "../utils/enterToNext.js";

const parseFamilyMembers = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((member) => {
          if (!member || typeof member !== "object") return null;
          const name = String(member.name || "").trim();
          const passportOrIqama = String(member.passportOrIqama || member.passport || member.iqama || "").trim();
          if (!name && !passportOrIqama) return null;
          return { name, passportOrIqama };
        })
        .filter(Boolean);
    }
  } catch (err) {
    // Legacy format fallback.
  }
  return String(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((passportOrIqama) => ({ name: "", passportOrIqama }));
};

const calcFinalAmount = (traveler) => {
  if (!traveler) return 0;
  const count = traveler.travelerType === "FAMILY" ? Number(traveler.familyCount || 1) : 1;
  const custom = Number(traveler.customPrice || 0);
  const base = custom || Number(traveler.trip?.seasonalPrice || 0);
  return Math.max(base * count + Number(traveler.extraRoomCharge || 0), 0);
};

const formatTravelerType = (type) => {
  if (!type) return "";
  return String(type).toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
};
export default function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const perms = parsePermissions(user?.permissions);
  const [query, setQuery] = useState("");
  const [travelers, setTravelers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState("UNPAID");
  const [tripFilter, setTripFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [form, setForm] = useState({
    amountPaid: "",
    paymentType: "FULL",
    extraRoomCharge: "0",
    customPrice: "0"
  });

  const loadData = async () => {
    try {
      const [travelerData, tripData] = await Promise.all([
        apiFetch("/travelers"),
        apiFetch("/trips")
      ]);
      setTravelers(travelerData);
      setTrips(tripData);
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return travelers.filter((traveler) => {
      const text = `${traveler.travelerName} ${traveler.passportOrIqama} ${traveler.phoneNumber || ""}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (paymentFilter === "PAID" && traveler.paymentStatus !== "PAID") return false;
      if (paymentFilter === "PARTIAL" && traveler.paymentStatus !== "PARTIAL") return false;
      if (paymentFilter === "UNPAID" && traveler.paymentStatus !== "UNPAID") return false;
      if (tripFilter && String(traveler.tripId) !== String(tripFilter)) return false;
      return true;
    });
  }, [travelers, query, paymentFilter, tripFilter]);

  const allSelected = filtered.length > 0 && filtered.every((traveler) => selectedIds.includes(traveler.id));
  const selectedTravelers = filtered.filter((traveler) => selectedIds.includes(traveler.id));

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((traveler) => traveler.id === id)));
  }, [filtered]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((traveler) => traveler.id === id)));
    } else {
      const ids = filtered.map((traveler) => traveler.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const openPayment = (traveler) => {
    const inferredType = traveler.paymentStatus === "PAID" ? "FULL" : traveler.paymentStatus === "PARTIAL" ? "PARTIAL" : "PARTIAL";
    setSelected(traveler);
    setForm({
      amountPaid: traveler.amountPaid,
      paymentType: inferredType,
      extraRoomCharge: traveler.extraRoomCharge,
      customPrice: traveler.customPrice
    });
    setIsPaymentOpen(true);
  };

  const closePayment = () => {
    setIsPaymentOpen(false);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      const payload = { ...form };
      const updated = await apiFetch(`/travelers/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setTravelers((prev) => prev.map((item) => (
        item.id === selected.id ? updated : item
      )));
      setSelected(updated);
      toast({ title: "Payment updated.", variant: "success" });
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };


  const handleBulkMarkPaid = async () => {
    if (bulkLoading || selectedTravelers.length === 0) return;
    const targets = selectedTravelers.filter((traveler) => traveler.paymentStatus !== "PAID");
    if (!targets.length) return;
    if (!window.confirm(`Mark ${targets.length} traveler(s) as paid?`)) return;
    setBulkLoading(true);
    try {
      const updates = await Promise.all(targets.map(async (traveler) => {
        const total = calcFinalAmount(traveler);
        return apiFetch(`/travelers/${traveler.id}`, {
          method: "PUT",
          body: JSON.stringify({ amountPaid: total, paymentType: "FULL" })
        });
      }));
      const updatedMap = new Map(updates.map((traveler) => [traveler.id, traveler]));
      setTravelers((prev) => prev.map((item) => updatedMap.get(item.id) ?? item));
      if (selected && updatedMap.has(selected.id)) {
        setSelected(updatedMap.get(selected.id));
      }
      setSelectedIds([]);
      toast({ title: "Selected payments marked as PAID.", variant: "success" });
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkMarkUnpaid = async () => {
    if (bulkLoading || selectedTravelers.length === 0) return;
    if (!window.confirm(`Mark ${selectedTravelers.length} traveler(s) as unpaid?`)) return;
    setBulkLoading(true);
    try {
      const updates = await Promise.all(selectedTravelers.map((traveler) => apiFetch(`/travelers/${traveler.id}`, {
        method: "PUT",
        body: JSON.stringify({ amountPaid: 0 })
      })));
      const updatedMap = new Map(updates.map((traveler) => [traveler.id, traveler]));
      setTravelers((prev) => prev.map((item) => updatedMap.get(item.id) ?? item));
      if (selected && updatedMap.has(selected.id)) {
        setSelected(updatedMap.get(selected.id));
      }
      setSelectedIds([]);
      toast({ title: "Selected payments marked as UNPAID.", variant: "success" });
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleMarkPaid = async (traveler) => {
    const count = traveler.travelerType === "FAMILY" ? Number(traveler.familyCount || 1) : 1;
    const custom = Number(traveler.customPrice || 0);
    const base = custom || Number(traveler.trip?.seasonalPrice || 0);
    const total = Math.max(base * count + Number(traveler.extraRoomCharge || 0), 0);
    try {
      const updated = await apiFetch(`/travelers/${traveler.id}`, {
        method: "PUT",
        body: JSON.stringify({ amountPaid: total, paymentType: "FULL" })
      });
      setTravelers((prev) => prev.map((item) => (
        item.id === traveler.id ? updated : item
      )));
      if (selected?.id === traveler.id) {
        setSelected(updated);
      }
      toast({ title: "Payment marked as PAID.", variant: "success" });
    } catch (err) {
      toast({ title: err.message, variant: "error" });
    }
  };

  const familyCount = selected?.travelerType === "FAMILY" ? Number(selected?.familyCount || 1) : 1;
  const selectedFamilyMembers = selected?.travelerType === "FAMILY" ? parseFamilyMembers(selected?.coPassengers) : [];
  const customPrice = Number(form.customPrice || 0);
  const basePrice = customPrice || Number(selected?.trip?.seasonalPrice || 0);
  const finalAmount = Math.max(basePrice * familyCount + Number(form.extraRoomCharge || 0), 0);
  const balanceDue = Math.max(finalAmount - Number(form.amountPaid || 0), 0);

  useEffect(() => {
    if (!isPaymentOpen) return;
    if (form.paymentType === "FULL") {
      setForm((prev) => ({ ...prev, amountPaid: finalAmount }));
    }
  }, [form.paymentType, finalAmount, isPaymentOpen]);
  if (!perms.can_manage_payments && user?.role !== "ADMIN") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sand-600">You do not have access to payment entry.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Payment Entry</h1>
        <p className="text-sm text-sand-600">Search travelers and update payment details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Travelers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by name, passport, or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="ALL">All payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </Select>
            <Select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)}>
              <option value="">All trips</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.package?.packageName} ({formatDate(trip.tripDate)})
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-3 text-xs text-sand-600">Showing {filtered.length} travelers</p>
          {selectedIds.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
              <span className="text-xs font-semibold text-sand-700">Selected: {selectedIds.length}</span>
              <Button size="sm" variant="outline" onClick={handleBulkMarkPaid} disabled={bulkLoading}>Mark Paid</Button>
              <Button size="sm" variant="outline" onClick={handleBulkMarkUnpaid} disabled={bulkLoading}>Mark Unpaid</Button>
            </div>
          ) : null}
          <div className="mt-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Passport</TableHeaderCell>
                  <TableHeaderCell>Trip</TableHeaderCell>
                  <TableHeaderCell>Payment</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {filtered.map((traveler) => (
                  <TableRow key={traveler.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(traveler.id)}
                        onChange={() => toggleSelect(traveler.id)}
                      />
                    </TableCell>
                    <TableCell>{traveler.travelerName}</TableCell>
                    <TableCell>{traveler.passportOrIqama}</TableCell>
                    <TableCell>{traveler.trip?.package?.packageName}</TableCell>
                    <TableCell>
  <div className="space-y-1">
    <div>Paid: {formatCurrency(traveler.amountPaid)}</div>
    <div className="text-xs text-sand-500">{traveler.paymentStatus}</div>
    {traveler.paymentStatus === "PARTIAL" ? (
      <div className="text-xs text-sand-600">
        Balance: {formatCurrency(Math.max(calcFinalAmount(traveler) - Number(traveler.amountPaid || 0), 0))}
      </div>
    ) : null}
    {traveler.paymentStatus === "UNPAID" ? (
      <div className="text-xs text-sand-600">
        Balance: {formatCurrency(calcFinalAmount(traveler))}
      </div>
    ) : null}
  </div>
</TableCell>
                    <TableCell className="max-w-none">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkPaid(traveler)}
                          disabled={traveler.paymentStatus === "PAID"}
                        >
                           {traveler.paymentStatus === "PAID" ? 'Paid' : "Pay"}
                        </Button>
                        {traveler.paymentStatus !== "PAID" ? (
  <Button size="sm" variant="outline" onClick={() => openPayment(traveler)}>
    Edit Payment
  </Button>
) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Modal open={isPaymentOpen} onClose={closePayment} size="lg">
        <ModalHeader>
          <ModalTitle>Payment Details</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {selected ? (
            <>
              <div className="mb-4 text-sm text-sand-600">
                <div>{selected.travelerName} - {selected.passportOrIqama}</div>
                {selected.travelerType === "FAMILY" ? (
                  <div>Family Members: {selected.familyCount || 1}</div>
                ) : (
                  <div>{formatTravelerType(selected.travelerType)}</div>
                )}
              </div>
              {selected.travelerType === "FAMILY" && selectedFamilyMembers.length ? (
                <div className="mb-4 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">
                  <p className="mb-1 font-semibold text-sand-600">Family Members</p>
                  <div className="space-y-1">
                    {selectedFamilyMembers.map((member, index) => (
                      <div key={`${index}-${member.name || member.passportOrIqama || "member"}`}>
                        {member.name ? `${member.name} - ` : ""}{member.passportOrIqama}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => e.preventDefault()} onKeyDown={handleEnterToNext}>
                {form.paymentType === "PARTIAL" ? (
                  <div>
                    <label className="text-xs font-semibold text-sand-600">Partial Paid Amount</label>
                    <Input
                      type="number"
                      value={form.amountPaid}
                      onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                      readOnly={form.paymentType === "FULL"}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-sand-600">Payment Amount</label>
                    <Input
                      type="number"
                      value={form.amountPaid}
                      onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                      readOnly={form.paymentType === "FULL"}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-sand-600">Payment Type</label>
                  <Select
                    value={form.paymentType}
                    onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
                  >
                    <option value="FULL">Full Payment</option>
                    <option value="PARTIAL">Partial Payment</option>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-sand-600">Extra Room Charge</label>
                  <Input
                    type="number"
                    value={form.extraRoomCharge}
                    onChange={(e) => setForm({ ...form, extraRoomCharge: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-sand-600">Custom Price</label>
                  <Input
                    type="number"
                    value={form.customPrice}
                    onChange={(e) => setForm({ ...form, customPrice: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-sand-600">Final Amount</label>
                  <Input value={finalAmount} readOnly />
                </div>
                <div>
                  <label className="text-xs font-semibold text-sand-600">Balance Due</label>
                  <Input value={balanceDue} readOnly />
                </div>
                {selected.travelerType === "FAMILY" ? (
                  <div>
                    <label className="text-xs font-semibold text-sand-600">Total Family Amount</label>
                    <Input value={finalAmount} readOnly />
                  </div>
                ) : null}
              </form>
              <div className="mt-4 flex gap-2 justify-end">
                <Button onClick={handleSave}>Save Payment</Button>
                <Button variant="outline" onClick={closePayment}>Close</Button>
              </div>
            </>
          ) : null}
        </ModalBody>
      </Modal>
    </div>
  );
}
