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
  { href: "/", label: "홈", icon: Home, match: (p) => p === "/" },
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

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur lg:block safe-top">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-3">
        <Link href="/" className="text-base font-semibold">
          chedo-prep
        </Link>
        <nav
          role="navigation"
          aria-label="주 메뉴"
          className="ml-6 flex items-center gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
