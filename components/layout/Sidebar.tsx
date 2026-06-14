"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, BarChart3, Settings, FileText } from "lucide-react";
import Image from "next/image";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    {
      label: "Rankings",
      href: "/rankings",
      icon: BarChart3,
    },
    {
      label: "Reports",
      href: "/reports",
      icon: FileText,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    return pathname?.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white pt-8 border-r border-slate-200">
      <div className="px-4">
        <Image
          src="/UPF_logo.png"
          alt="UPF Logo"
          width={148}
          height={148}
          priority
        />
      </div>

      <nav className="space-y-2 px-4 py-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? "bg-[#F2F4F8] text-[#21272A]"
                  : "text-[#21272A] hover:bg-[#E7E7E8]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-6 left-4 right-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#D7142A] transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}