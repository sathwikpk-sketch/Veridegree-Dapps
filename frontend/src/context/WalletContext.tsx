"use client";

import { BrowserProvider, JsonRpcSigner } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE, CHAIN_HEX, CHAIN_ID } from "@/lib/config";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window { ethereum?: EthereumProvider; }
}

type WalletSession = { address: string; role: string; accessToken: string; expiresIn: number };
type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  connected: boolean;
  session: WalletSession | null;
  busy: boolean;
  error: string;
  connect: () => Promise<string>;
  getSigner: () => Promise<JsonRpcSigner>;
  signIn: () => Promise<WalletSession>;
  signOut: () => void;
  clearError: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask was not detected. Install the MetaMask browser extension.");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (switchError) {
      const code = (switchError as { code?: number }).code;
      if (code === 4902) {
        throw new Error("Sepolia is not added to MetaMask yet. Add the Sepolia Test Network in MetaMask, then reconnect.");
      }
      throw switchError;
    }
  }, []);

  const connect = useCallback(async () => {
    setBusy(true); setError("");
    try {
      if (!window.ethereum) throw new Error("MetaMask is not installed. Add the MetaMask extension and try again.");
      const provider = new BrowserProvider(window.ethereum as never);
      let accounts = await provider.send("eth_requestAccounts", []) as string[];
      if (!accounts.length) throw new Error("No wallet account was returned.");
      let network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        await switchToSepolia();
        const refreshed = new BrowserProvider(window.ethereum as never);
        accounts = await refreshed.send("eth_accounts", []) as string[];
        network = await refreshed.getNetwork();
      }
      if (Number(network.chainId) !== CHAIN_ID) throw new Error("Switch MetaMask to Sepolia to continue.");
      setAddress(accounts[0]); setChainId(Number(network.chainId)); setSession(null);
      return accounts[0];
    } catch (err) {
      const message = (err as Error).message || "Wallet connection failed.";
      setError((err as { code?: number }).code === 4001 ? "You rejected the wallet connection request." : message);
      throw err;
    } finally { setBusy(false); }
  }, [switchToSepolia]);

  const getSigner = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    const provider = new BrowserProvider(window.ethereum as never);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      await switchToSepolia();
      const nextProvider = new BrowserProvider(window.ethereum as never);
      return nextProvider.getSigner();
    }
    return provider.getSigner();
  }, [switchToSepolia]);

  const signIn = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const wallet = address || await connect();
      const signer = await getSigner();
      const challenge = await fetch(`${API_BASE}/api/auth/challenge`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: wallet })
      });
      const challengeData = await challenge.json();
      if (!challenge.ok) throw new Error(challengeData.detail || "Could not create wallet sign-in challenge.");
      const signature = await signer.signMessage(challengeData.message);
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet, message: challengeData.message, signature })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Wallet sign-in failed.");
      const auth = data as WalletSession;
      setSession(auth);
      return auth;
    } catch (err) {
      const e = err as { code?: number; message?: string };
      const message = e.code === 4001 ? "You rejected the signature request." : e.message || "Wallet sign-in failed.";
      setError(message); throw err;
    } finally { setBusy(false); }
  }, [address, connect, getSigner]);

  const signOut = useCallback(() => setSession(null), []);
  const clearError = useCallback(() => setError(""), []);

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const onAccounts = (...args: unknown[]) => { const list = args[0] as string[]; setAddress(list?.[0] || null); setSession(null); };
    const onChain = (...args: unknown[]) => { const hex = String(args[0] || "0x0"); setChainId(Number.parseInt(hex, 16)); setSession(null); };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => { window.ethereum?.removeListener?.("accountsChanged", onAccounts); window.ethereum?.removeListener?.("chainChanged", onChain); };
  }, []);

  const value = useMemo(() => ({ address, chainId, connected: !!address, session, busy, error, connect, getSigner, signIn, signOut, clearError }), [address, chainId, session, busy, error, connect, getSigner, signIn, signOut, clearError]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider.");
  return context;
}
