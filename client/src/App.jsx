import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Trips from "./pages/Trips.jsx";
import Packages from "./pages/Packages.jsx";
import Travelers from "./pages/Travelers.jsx";
import Expenses from "./pages/Expenses.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";
import Drivers from "./pages/Drivers.jsx";
import Ameers from "./pages/Ameers.jsx";
import Providers from "./pages/Providers.jsx";
import Payments from "./pages/Payments.jsx";
import Buses from "./pages/Buses.jsx";
import NotFound from "./pages/NotFound.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function HomeRoute() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? <Dashboard /> : <Navigate to="/trips" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? children : <Navigate to="/trips" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRoute />} />
        <Route path="trips" element={<Trips />} />
        <Route path="packages" element={<AdminRoute><Packages /></AdminRoute>} />
        <Route path="travelers" element={<Travelers />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="ameers" element={<Ameers />} />
        <Route path="providers" element={<Providers />} />
        <Route path="payments" element={<Payments />} />
        <Route path="buses" element={<AdminRoute><Buses /></AdminRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
    </Routes>
  );
}




