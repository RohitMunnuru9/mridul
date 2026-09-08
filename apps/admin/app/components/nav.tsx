"use client";

/**
 * Admin sidebar.
 *
 * Client-side only so the current section can be highlighted; the section list
 * itself is static because these are application areas, not content.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Package, Settings, Tags, type LucideIcon } from "lucide-react";

type Section = { href: string; label: string; icon: LucideIcon; group: string };

const SECTIONS: Section[] = [
  { href: "/", label: "Start", icon: LayoutDashboard, group: "Everyday" },
  { href: "/products", label: "All products", icon: Package, group: "Everyday" },
  { href: "/categories", label: "Categories", icon: Tags, group: "Occasional" },
  { href: "/homepage", label: "Homepage", icon: Home, group: "Occasional" },
  { href: "/settings", label: "Settings", icon: Settings, group: "Occasional" },
];

const GROUPS = ["Everyday", "Occasional"];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {GROUPS.map((group) => (
        <div className="admin-nav-group" key={group}>
          <h2>{group}</h2>
          {SECTIONS.filter((section) => section.group === group).map(
            ({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={active ? "is-active" : undefined}
                  href={href}
                  key={href}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Link>
              );
            },
          )}
        </div>
      ))}
    </nav>
  );
}

