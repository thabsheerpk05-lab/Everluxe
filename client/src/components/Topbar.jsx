import { Menu, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./ui/button.jsx";

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between rounded-2xl border border-sand-200 bg-white/80 px-4 py-3 shadow-soft backdrop-blur">
      <div className="flex items-center gap-3">
        <button className="lg:hidden" onClick={onMenu} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <div>
          <p className="text-sm text-sand-600">Welcome back</p>
          <p className="font-semibold">{user?.name}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut size={16} className="mr-2" />
        Logout
      </Button>
    </header>
  );
}
