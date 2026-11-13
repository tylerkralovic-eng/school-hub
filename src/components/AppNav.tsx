"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/share", label: "Share", icon: "share" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar on phones. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  active ? "text-indigo-600" : "text-slate-500"
                }`}
              >
                <Icon name={t.icon} className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Inline tab links on tablet/desktop. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex gap-1 rounded-full bg-slate-100 p-1">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
