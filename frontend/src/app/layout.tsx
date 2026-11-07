import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletProviderShell } from "@/components/WalletProviderShell";
import { ScrollProgress } from "@/components/ScrollProgress";

export const metadata: Metadata = {
  title: "VeriDegree — Credentials you can check",
  description: "A privacy-conscious academic credential registry secured by Ethereum. Verify a certificate in seconds, with no account and no phone calls.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WalletProviderShell><ScrollProgress /><SiteHeader />{children}<footer className="site-footer"><div className="footer-brand"><span className="brand-mark">V</span><span className="brand-name">Veri<span>Degree</span></span></div><div className="footer-meta"><span>Built on Ethereum · Sepolia</span><span>© {new Date().getFullYear()}</span></div></footer></WalletProviderShell></body></html>;
}
