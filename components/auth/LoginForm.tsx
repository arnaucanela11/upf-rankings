// components/auth/LoginForm.tsx

"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, googleProvider } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case "auth/invalid-email":
        return "The email address is not valid.";
      case "auth/user-not-found":
        return "No account found with this email.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password.";
      case "auth/popup-closed-by-user":
        return "Google login was cancelled.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      default:
        return "Something went wrong. Please try again.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );

      await signInWithEmailAndPassword(auth, email, password);

      router.push("/rankings");
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");

    try {
      setGoogleLoading(true);

      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );

      await signInWithPopup(auth, googleProvider);

      router.push("/rankings");
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setSuccessMessage("");

    if (!email) {
      setError("Please enter your email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Password reset email sent.");
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/rankings");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center w-full"
      style={{ backgroundImage: "url('/upf_bg.jpg')" }}
    >
      <div className="backdrop-brightness-95 bg-white shadow-2xl max-w-2xl w-full mx-6 my-6">
        <Card className="border-none bg-transparent shadow-none rounded-none">
          <CardHeader className="text-center py-10 px-8">
            <CardTitle className="text-4xl font-bold text-zinc-900">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-zinc-600 text-[16px] pt-2">
              Please log in with your personal credentials to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-black text-[16px]">
                  Email Address
                </Label>

                <Input
                  id="email"
                  type="email"
                  placeholder="you@upf.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-100 border border-zinc-200"
                />
              </div>

              <div className="space-y-2 mb-10">
                <Label htmlFor="password" className="text-black text-[16px]">
                  Password
                </Label>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-100 border border-zinc-200 pr-10"
                    aria-describedby="password-help"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <p id="password-help" className="text-xs text-zinc-500">
                  It must be at least 8 characters including numbers and
                  symbols.
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="remember"
                    className="font-normal text-zinc-700"
                  >
                    Remember me
                  </Label>
                </div>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-zinc-700 cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {error && (
                <p className="text-sm text-center text-red-600">{error}</p>
              )}

              {successMessage && (
                <p className="text-sm text-center text-emerald-600">
                  {successMessage}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D7142A] cursor-pointer text-[14px]"
              >
                {loading ? "Logging in..." : "Log In"}
              </Button>
            </form>

            <div className="my-6">
              <Separator />
            </div>

            <div className="text-center text-sm text-zinc-500 my-1 pb-3">
              Or log in with:
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full bg-white text-[#D7142A] hover:text-[#D7142A] cursor-pointer text-[14px]"
            >
              {googleLoading ? "Connecting..." : "Google"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
