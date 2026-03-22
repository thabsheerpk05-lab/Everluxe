import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-ink/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 overflow-x-hidden px-6 pb-10 pt-4 ">
        <Topbar onMenu={() => setOpen((prev) => !prev)} />
        <div className="mt-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
