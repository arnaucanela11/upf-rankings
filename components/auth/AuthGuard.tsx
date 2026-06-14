"use client";

import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";

import { auth } from "@/lib/firebase";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsAuthenticated(false);
        setCheckingAuth(false);

        if (pathname !== "/login") {
          router.replace("/login");
        }

        return;
      }

      setIsAuthenticated(true);
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}