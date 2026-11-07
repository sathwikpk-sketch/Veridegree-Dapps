"use client";

import { WalletProvider } from "@/context/WalletContext";

export function WalletProviderShell({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
