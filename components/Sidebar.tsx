"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { FileText, BarChart3, Home, MessageCircle, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    icon: Home,
    matchExact: true,
  },
  {
    label: "Invoices",
    href: "/maintenance/invoices",
    icon: FileText,
    matchPrefix: "/maintenance",
    badge: null as string | null,
  },
  {
    label: "Rent Comps",
    href: "/comps",
    icon: BarChart3,
    matchPrefix: "/comps",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Don't show sidebar on login page
  if (pathname === "/login") return null;

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "??";

  const firstName = session?.user?.name?.split(" ")[0] ?? "User";

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] sidebar-gradient shadow-sidebar z-50 flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/HDPM-PrimaryLogo-White.png"
            alt="HDPM"
            width={120}
            height={40}
            className="opacity-90 group-hover:opacity-100 transition-opacity"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.matchExact
              ? pathname === item.href
              : pathname.startsWith(item.matchPrefix ?? item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group relative",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-charcoal-400 hover:text-white hover:bg-white/[0.05]"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-terra-500 rounded-r-full" />
                )}
                <Icon className={cn("w-[18px] h-[18px]", isActive ? "text-terra-400" : "")} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-charcoal-500" />
                )}
              </Link>
            );
          })}
        </div>

        {/* AI Chat section */}
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <p className="px-3 mb-2 text-2xs font-semibold text-charcoal-500 uppercase tracking-widest">
            AI Assistant
          </p>
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-charcoal-400 hover:text-white hover:bg-white/[0.05] transition-all duration-150 w-full text-left group"
            onClick={() => {
              // Trigger chat widget open - dispatch custom event
              window.dispatchEvent(new CustomEvent("open-chat"));
            }}
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span className="flex-1">Knowledge Base</span>
            <span className="w-2 h-2 rounded-full bg-green-400 opacity-75" />
          </button>
        </div>
      </nav>

      {/* User section at bottom */}
      <div className="px-3 pb-4 mt-auto">
        <div className="border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-terra-500/20 border border-terra-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xs font-bold text-terra-400">
                {initials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {firstName}
              </p>
              <p className="text-2xs text-charcoal-500 truncate">
                {session?.user?.email ?? ""}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-charcoal-500 hover:text-charcoal-300 transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
