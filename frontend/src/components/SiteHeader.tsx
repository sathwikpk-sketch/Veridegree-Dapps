"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";

const links = [
  { href: "/verify", label: "Verify a credential" },
  { href: "/institution", label: "For institutions" },
  { href: "/student", label: "Student access" }
];

export function SiteHeader() {
  const pathname = usePathname();
  return <header className="site-header">
    <Link href="/" className="brand-lockup" aria-label="VeriDegree home">
      <span className="brand-mark">V</span>
      <span className="brand-name">Veri<span>Degree</span></span>
      <span className="network-chip"><i />SEPOLIA</span>
    </Link>
    <nav className="desktop-nav">
      {links.map(link => <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>{link.label}</Link>)}
    </nav>
    <WalletButton />
  </header>;
}
