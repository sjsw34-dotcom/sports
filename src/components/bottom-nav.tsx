"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, FileText, Bookmark, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "홈",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    href: "/subjects",
    label: "과목",
    icon: BookOpen,
    match: (p) => p.startsWith("/subjects"),
  },
  {
    href: "/years",
    label: "기출",
    icon: FileText,
    match: (p) => p.startsWith("/years"),
  },
  {
    href: "/review",
    label: "오답",
    icon: Bookmark,
    match: (p) => p.startsWith("/review"),
  },
  {
    href: "/stats",
    label: "통계",
    icon: BarChart3,
    match: (p) => p.startsWith("/stats"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto flex max-w-screen-md items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs transition-colors",
                  active
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
