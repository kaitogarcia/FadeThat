"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "fade that", className: "fade-link", exact: true },
  { href: "https://fadethat.life/tooling", label: "submit", external: true },
  { href: "/tooling", label: "tooling" },
  { href: "/optin", label: "optin" },
  { href: "/privacy", label: "privacy" },
  { href: "/terms", label: "terms" },
];

function isActivePath(pathname, href, exact) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      {navItems.map((item) => {
        const className = item.className || undefined;

        if (item.external) {
          return (
            <a className={className} href={item.href} key={item.label}>
              {item.label}
            </a>
          );
        }

        const active = isActivePath(pathname, item.href, item.exact);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={className}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
