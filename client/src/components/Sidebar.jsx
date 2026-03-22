import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { parsePermissions } from "../utils/permissions.js";
import {
  LayoutGrid,
  Plane,
  Package,
  Users2,
  Wallet,
  FileText,
  UserCog,
  Car,
  Users,
  Building2,
  Bus,
  CreditCard
} from "lucide-react";

const navItems = [
  { name: "Dashboard", path: "/", icon: LayoutGrid },
  { name: "Trips", path: "/trips", icon: Plane, permission: "can_view_trips" },
  { name: "Packages", path: "/packages", icon: Package, permission: "can_view_packages" },
  { name: "Travelers", path: "/travelers", icon: Users2, permission: "can_view_travelers" },
  { name: "Expenses", path: "/expenses", icon: Wallet, permission: "can_view_expenses" },
  { name: "Reports", path: "/reports", icon: FileText, permission: "can_view_reports" },
  { name: "Payments", path: "/payments", icon: CreditCard, permission: "can_manage_payments" }
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const perms = parsePermissions(user?.permissions);

  const items = user?.role === "ADMIN"
    ? [
        ...navItems,
        { name: "Users", path: "/users", icon: UserCog },
        { name: "Drivers", path: "/drivers", icon: Car },
        { name: "Buses", path: "/buses", icon: Bus },
        { name: "Ameers", path: "/ameers", icon: Users },
        { name: "Providers", path: "/providers", icon: Building2 }
      ]
    : navItems.filter(
        (item) =>
          item.name !== "Dashboard" &&
          item.name !== "Packages" &&
          (!item.permission || perms[item.permission])
      );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-sand-200 bg-white/90 px-4 py-6 shadow-soft backdrop-blur transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-8">
        <p className="font-display text-xl text-ink">Wadinoor</p>
        <p className="text-xs uppercase tracking-[0.2em] text-sand-600">Daily Umrah Service</p>
      </div>
      <nav className="space-y-2">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            onClick={() => {
              if (open) {
                onClose?.();
              }
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-oasis-500 text-white shadow-lift"
                  : "text-ink/70 hover:bg-sand-100"
              }`
            }
          >
            <item.icon size={18} />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}



