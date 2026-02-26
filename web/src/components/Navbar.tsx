import { useNavigate } from "react-router-dom";
import { useStore } from '@nanostores/react';
import useAuth from "@/hooks/useAuth";
import { $isAuthenticated } from '@/store/auth';

const Navbar = () => {
  const isAuthenticated = useStore($isAuthenticated);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const navTabClass =
    "cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--token-highlight-bg)] hover:text-foreground hover:shadow-[0_0_0_1px_var(--highlight-ring)]";

  return (
    <nav className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
      <ul className="tutorial-nav-pill glass-panel overflow-hidden flex items-center gap-1 rounded-full p-1">
        <li>
          <button
            type="button"
            className={navTabClass}
            onClick={() => navigate("/")}
          >
            Tutorial
          </button>
        </li>
        <li>
          <button
            type="button"
            className={navTabClass}
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
        </li>
        {isAuthenticated ? (
          <li>
            <button
              type="button"
              className={navTabClass}
              onClick={logout}
            >
              Logout
            </button>
          </li>
        ) : (
          <li>
            <button
              type="button"
              className={navTabClass}
              onClick={() => navigate("/login")}
            >
              Login
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
};

export default Navbar;
