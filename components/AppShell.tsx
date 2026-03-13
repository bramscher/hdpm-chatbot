"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen page-texture">
      <Sidebar />
      <main className="ml-[220px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
