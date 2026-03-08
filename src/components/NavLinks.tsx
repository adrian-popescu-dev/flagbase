"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard/flags", label: "Flags" },
  { href: "/dashboard/experiments", label: "Experiments" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
