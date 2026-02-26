import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import useAuth from "../hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GOOGLE_CLIENT_ID } from "@/env";
import { useEffect, useRef } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

const Signup = () => {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleButtonContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;  
    const formData = new FormData(form);
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    
    const result = await register(email, username, password);
    if (!result.success) {
      toast.error(result.error, {
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

    const renderGoogleButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      const containerWidth = Math.floor(
        googleButtonContainerRef.current?.getBoundingClientRect().width ?? 320
      );
      const buttonWidth = Math.max(220, Math.min(320, containerWidth));
      googleButtonRef.current.innerHTML = "";
      google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        size: "large",
        text: "signup_with",
        shape: "rectangular",
        theme: "outline",
        width: buttonWidth,
      });
    };

    const initializeGoogleButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: GoogleCredentialResponse) => {
          if (!response.credential) {
            toast.error("Google sign-up failed", { position: "bottom-left" });
            return;
          }

          const result = await loginWithGoogle(response.credential);
          if (!result.success) {
            toast.error(result.error || "Google sign-up failed", {
              position: "bottom-left",
            });
            return;
          }

          navigate("/dashboard");
        },
      });
      renderGoogleButton();
    };
    const handleResize = () => renderGoogleButton();
    window.addEventListener("resize", handleResize);

    if ((window as any).google?.accounts?.id) {
      initializeGoogleButton();
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    const existingScript = document.getElementById("google-gsi-script");
    if (existingScript) {
      existingScript.addEventListener("load", initializeGoogleButton, {
        once: true,
      });
      return () => {
        window.removeEventListener("resize", handleResize);
        existingScript.removeEventListener("load", initializeGoogleButton);
      };
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleButton;
    document.head.appendChild(script);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-20 sm:min-h-screen sm:pt-20">
      <div className="glass-panel w-full max-w-sm space-y-8 rounded-2xl px-6 py-7 sm:px-8 sm:py-8">
        <div>
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Create a new account
          </h2>
          <p className="mt-2 text-sm text-center text-muted-foreground">
            Or{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:text-primary/80 hover:underline"
            >
              sign in to your existing account
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
            <Label htmlFor="username">Username</Label>
            <div className="mt-1">
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Enter a username"
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
              Sign up
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
              <div ref={googleButtonContainerRef} className="w-full max-w-[320px]">
                <div ref={googleButtonRef} />
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
};

export default Signup;
