import { Route, Routes } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useMemo } from "react";
import useAuth from "@/hooks/useAuth";
import { $isAuthenticated, setIsAuthenticated } from "./store/auth";
import { useStore } from "@nanostores/react";
import Game from "./pages/Game";

// Pages
import Tutorial from "./pages/Tutorial";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";


function App() {
  const { validate } = useAuth();
  const authenticationRoutes = ["/login", "/register"];
  const isAuthenticated = useStore($isAuthenticated);
  
  const isInAuthenticationRoute = useMemo(() => {
    return authenticationRoutes.includes(window.location.pathname);
  }, [window.location.pathname]);
  
  // Validate auth state but allow guests to browse the app.
  useEffect(() => {
    const checkValidation = async () => {
      const isValidated = await validate();
      setIsAuthenticated(isValidated);
      if (isInAuthenticationRoute && isValidated) {
        window.location.href = "/dashboard";
      }
    };
    checkValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Tutorial />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/game/:id" element={<Game />} />
      </Routes>
    </div>
  );
}

export default App;
