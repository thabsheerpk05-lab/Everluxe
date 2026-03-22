import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar open={open} />
      <div className="flex-1 overflow-x-hidden px-6 pb-10 pt-4 ">
        <Topbar onMenu={() => setOpen((prev) => !prev)} />
        <div className="mt-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
