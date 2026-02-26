import { useNavigate } from "react-router-dom";
import { useStore } from '@nanostores/react';
import useAuth from "@/hooks/useAuth";
import { $isAuthenticated } from '@/store/auth';

const Navbar = () => {
  const isAuthenticated = useStore($isAuthenticated);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const navTabClass =
    "cursor-pointer rounded-full px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--token-highlight-bg)] hover:text-foreground hover:shadow-[0_0_0_1px_var(--highlight-ring)] sm:px-4 sm:py-2 sm:text-sm";

  return (
    <nav className="fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 sm:top-4 sm:w-auto">
      <ul className="tutorial-nav-pill glass-panel flex w-full items-center justify-between gap-1 overflow-hidden rounded-full p-1 sm:w-auto sm:justify-start">
        <li>
          <button
            type="button"
            className={navTabClass}
            onClick={() => navigate("/tutorial")}
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
