"use client";

import { useWallet } from "@/context/WalletContext";
import { shortAddress } from "@/lib/api";

export function WalletButton() {
  const { address, connect, busy, error } = useWallet();
  return <div className="wallet-control">
    <button className={`wallet-button ${address ? "is-connected" : ""}`} onClick={() => void connect().catch(() => undefined)} disabled={busy}>
      <span className="wallet-indicator" />{busy ? "Connecting…" : address ? shortAddress(address) : "Connect wallet"}
    </button>
    {error && <span className="wallet-inline-error" title={error}>{error}</span>}
  </div>;
}
