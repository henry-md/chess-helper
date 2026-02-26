import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";
import useAuth from "@/hooks/useAuth";
import Game from "./pages/Game";

// Pages
import Tutorial from "./pages/Tutorial";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";


function App() {
  const { validate } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authenticationRoutes = ["/login", "/register"];
  const isInAuthenticationRoute = authenticationRoutes.includes(location.pathname);
  
  // Validate auth state but allow guests to browse the app.
  useEffect(() => {
    let isMounted = true;

    const checkValidation = async () => {
      const isValidated = await validate();
      if (!isMounted) {
        return;
      }

      if (isInAuthenticationRoute && isValidated) {
        navigate("/dashboard", { replace: true });
      }
    };

    checkValidation();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInAuthenticationRoute, location.pathname, navigate]);
  
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Navigate to="/tutorial" replace />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/game/:id" element={<Game />} />
      </Routes>
    </div>
  );
}

export default App;
