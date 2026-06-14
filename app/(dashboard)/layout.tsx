import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: "#F2F4F8" }}>
        <Sidebar />

        {/* Main content area - offset by sidebar and header */}
        <main className="ml-64 p-8 px-4">{children}</main>
      </div>
    </AuthGuard>
  );
}
