"use client";

/**
 * Admin navigation.
 *
 * Two shapes, one list. On a wide screen it is the sidebar: ten sections, all
 * visible, grouped into the ones used every day and the ones used occasionally.
 *
 * On a phone it collapses to a single button. The previous attempt kept every
 * section but laid them out as one row that scrolled sideways, which was a
 * mistake of the particular kind that looks fine to whoever built it: the first
 * three fit, so the row looks complete, and the remaining seven are off the
 * edge with nothing to suggest they exist. Nobody scrolls a bar they have no
 * reason to think continues. "Customers" was cut to "Cu" and Stock, Categories,
 * Collections, Photos, Homepage and Settings were simply unreachable.
 *
 * So the button says where you are and that there is more, and opening it shows
 * all ten at once, still grouped, each a comfortable tap target.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronDown,
  History,
  Home,
  Images,
  LayoutDashboard,
  Layers,
  Package,
  Receipt,
  KeyRound,
  Settings,
  Tags,
  TicketPercent,
  Users,
  type LucideIcon,
} from "lucide-react";

type Section = { href: string; label: string; icon: LucideIcon; group: string };

const SECTIONS: Section[] = [
  { href: "/", label: "Start", icon: LayoutDashboard, group: "Everyday" },
  { href: "/orders", label: "Orders", icon: Receipt, group: "Everyday" },
  { href: "/products", label: "All products", icon: Package, group: "Everyday" },
  { href: "/customers", label: "Customers", icon: Users, group: "Everyday" },
  { href: "/inventory", label: "Stock", icon: Boxes, group: "Everyday" },
  { href: "/coupons", label: "Discount codes", icon: TicketPercent, group: "Occasional" },
  { href: "/categories", label: "Categories", icon: Tags, group: "Occasional" },
  { href: "/collections", label: "Collections", icon: Layers, group: "Occasional" },
  { href: "/media", label: "Photos", icon: Images, group: "Occasional" },
  { href: "/homepage", label: "Homepage", icon: Home, group: "Occasional" },
  { href: "/settings", label: "Settings", icon: Settings, group: "Occasional" },
  { href: "/staff", label: "Who has access", icon: KeyRound, group: "Occasional" },
  { href: "/activity", label: "Activity", icon: History, group: "Occasional" },
];

const GROUPS = ["Everyday", "Occasional"];

function isCurrent(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AdminNav() {
  const pathname = usePathname();
  const wrapper = useRef<HTMLDivElement>(null);

  // Open, and the page it was opened on.
  //
  // Closing on navigation is what makes this behave like a menu rather than a
  // panel to be dismissed — but it is derived rather than done in an effect:
  // the menu counts as open only while you are still on the page you opened it
  // from. Navigating closes it, including by the back button, with no extra
  // render and nothing to keep in sync.
  const [menu, setMenu] = useState({ open: false, at: pathname });
  const open = menu.open && menu.at === pathname;

  const close = () => setMenu({ open: false, at: pathname });

  const current = SECTIONS.find((section) => isCurrent(section.href, pathname));

  useEffect(() => {
    if (!open) return undefined;

    // The functional form, so these listeners close over nothing that changes
    // from render to render and the effect needs no dependency but `open`.
    const shut = () => setMenu((current) => ({ ...current, open: false }));

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") shut();
    };
    // A tap anywhere else closes it, including on the page behind — otherwise
    // the only way out is the button you may have already scrolled past.
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) shut();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="admin-nav-wrap" ref={wrapper}>
      {/* Phone only; the stylesheet hides it once the sidebar has room. */}
      <button
        aria-controls="admin-sections"
        aria-expanded={open}
        className="admin-nav-toggle"
        onClick={() => setMenu({ open: !open, at: pathname })}
        type="button"
      >
        {current ? <current.icon aria-hidden="true" /> : null}
        <span>
          {/* Where you are, then what the button does. Saying only "Menu"
              wastes the one line a phone gives you for orientation. */}
          <strong>{current?.label ?? "Admin"}</strong>
          <small>Explore options</small>
        </span>
        <ChevronDown aria-hidden="true" data-open={open} />
      </button>

      <nav
        aria-label="Admin sections"
        className="admin-nav"
        data-open={open}
        id="admin-sections"
      >
        {GROUPS.map((group) => (
          <div className="admin-nav-group" key={group}>
            <h2>{group}</h2>
            {SECTIONS.filter((section) => section.group === group).map(
              ({ href, label, icon: Icon }) => {
                const active = isCurrent(href, pathname);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? "is-active" : undefined}
                    href={href}
                    key={href}
                    onClick={close}
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
    </div>
  );
}
