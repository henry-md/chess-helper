import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import useAuth from "../hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "@/env";

type GoogleCredentialResponse = {
  credential?: string;
};

const Login = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  // handle form submission
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;  
    const formData = new FormData(form);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    const result = await login(email, password);
    if (!result.success) {
      toast.error("Incorrect email or password", {
        position: "bottom-left",
      });
    } else {
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return;
    }

    const initializeGoogleButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: GoogleCredentialResponse) => {
          if (!response.credential) {
            toast.error("Google sign-in failed", { position: "bottom-left" });
            return;
          }

          const result = await loginWithGoogle(response.credential);
          if (!result.success) {
            toast.error(result.error || "Google sign-in failed", {
              position: "bottom-left",
            });
            return;
          }

          navigate("/dashboard");
        },
      });

      googleButtonRef.current.innerHTML = "";
      google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        theme: "outline",
        width: 320,
      });
    };

    if ((window as any).google?.accounts?.id) {
      initializeGoogleButton();
      return;
    }

    const existingScript = document.getElementById("google-gsi-script");
    if (existingScript) {
      existingScript.addEventListener("load", initializeGoogleButton, {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleButton;
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-20">
      <div className="mx-auto w-full max-w-sm space-y-8 rounded-2xl border border-border/70 bg-card/60 px-8 py-8 shadow-[0_28px_52px_-34px_rgba(2,6,23,0.95)] backdrop-blur-sm">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-center text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-center text-muted-foreground">
            Or{" "}
            <Link
              to={"/register"}
              className="font-medium text-primary hover:text-primary/80 hover:underline"
            >
              create a new account
            </Link>
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit} method="POST">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="mt-1">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="mt-1">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter a password"
              />
            </div>
          </div>
          <div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </div>
        </form>
        {GOOGLE_CLIENT_ID && (
          <div className="pt-2">
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <div className="flex justify-center">
              <div ref={googleButtonRef} />
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
};

export default Login;
