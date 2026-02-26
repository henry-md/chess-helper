import { useNavigate } from "react-router-dom";
import { useStore } from '@nanostores/react';
import useAuth from "@/hooks/useAuth";
import { $isAuthenticated } from '@/store/auth';

const Navbar = () => {
  const isAuthenticated = useStore($isAuthenticated);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
      <ul className="flex items-center gap-1 rounded-full border border-border/70 bg-card/75 p-1 shadow-[0_18px_36px_-24px_rgba(2,6,23,0.9)] backdrop-blur-md">
        <li>
          <button
            type="button"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
            onClick={() => navigate("/")}
          >
            Tutorial
          </button>
        </li>
        <li>
          <button
            type="button"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
        </li>
        {isAuthenticated ? (
          <li>
            <button
              type="button"
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
              onClick={logout}
            >
              Logout
            </button>
          </li>
        ) : (
          <li>
            <button
              type="button"
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
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
