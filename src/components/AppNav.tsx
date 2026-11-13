"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/add", label: "Add", icon: "plus" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/tasks", label: "Tasks", icon: "task" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href) || (t.href === "/add" && pathname.startsWith("/review"));
          if (t.href === "/add")
            return (
              <li key={t.href} className="flex justify-center">
                <Link href={t.href} aria-current={active ? "page" : undefined} aria-label="Add school info" className="relative -mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 active:scale-95">
                  <Icon name="plus" className="h-7 w-7" strokeWidth={2.4} />
                  {reviewCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-amber-950">{reviewCount}</span>
                  )}
                </Link>
              </li>
            );
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-indigo-600" : "text-slate-500"}`}>
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

export function TopNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex gap-1 rounded-full bg-slate-100 p-1">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Icon name={t.icon} className="h-4 w-4" />
                {t.label}
                {t.href === "/add" && reviewCount > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-amber-950">{reviewCount}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
