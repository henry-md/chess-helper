import { useNavigate } from "react-router-dom";
import { useStore } from '@nanostores/react';
import useAuth from "@/hooks/use-auth.jsx";
import { $isAuthenticated } from '@/store/auth';

const Navbar = () => {
  const isAuthenticated = useStore($isAuthenticated);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <ul className="absolute top-0 left-0 right-0 flex items-center justify-end gap-2 mx-16">
      <li><a className="flex items-center px-4 py-4 cursor-pointer hover:text-yellow-600" onClick={() => navigate("/")}>Tutorial</a></li>
      <li><a className="flex items-center px-4 py-4 cursor-pointer hover:text-yellow-600" onClick={() => navigate("/dashboard")}>Dashboard</a></li>
      {isAuthenticated ? (
        <li><a className="flex items-center px-4 py-4 cursor-pointer hover:text-yellow-600" onClick={logout}>Logout</a></li>
      ) : (
        <li><a className="flex items-center px-4 py-4 cursor-pointer hover:text-yellow-600" onClick={() => navigate("/login")}>Login</a></li>
      )}
    </ul>
  )
};

export default Navbar;
