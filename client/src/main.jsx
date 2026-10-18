import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminPortal from "./AdminPortal.jsx";
import "./index.css";

const rootView = window.location.pathname.startsWith("/admin") ? <AdminPortal /> : <App />;
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode>{rootView}</React.StrictMode>);
