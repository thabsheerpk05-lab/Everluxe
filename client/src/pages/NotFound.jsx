import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button.jsx";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="font-display text-3xl">Page not found</h1>
      <Button onClick={() => navigate("/")}>Return to Dashboard</Button>
    </div>
  );
}
