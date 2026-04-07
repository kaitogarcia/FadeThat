"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "fade that", className: "fade-link", exact: true },
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
  const [fadeLinkHidden, setFadeLinkHidden] = useState(false);

  useEffect(() => {
    setFadeLinkHidden(false);
  }, [pathname]);

  const hideFadeLink = () => {
    if (fadeLinkHidden) {
      return;
    }
    setFadeLinkHidden(true);
  };

  return (
    <nav className="nav" aria-label="Primary">
      {navItems.map((item) => {
        const isFadeLink = item.className === "fade-link";
        const className = isFadeLink && fadeLinkHidden ? "fade-link is-gone" : item.className || undefined;

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
            onClick={isFadeLink ? hideFadeLink : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
