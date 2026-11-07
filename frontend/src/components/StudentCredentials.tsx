"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, formatDate, shortAddress } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import { LiveActivity } from "@/components/LiveActivity";

type Credential = { credentialId: number; certificateHash: string; issuer: string; student: string; issuedAt: number; revoked: boolean; issuerApproved: boolean; status: string };
type PageData = { student: string; offset: number; limit: number; hasMore: boolean; items: Credential[] };

export function StudentCredentials() {
  const { address, connect } = useWallet();
  const [data, setData] = useState<PageData | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  const load = useCallback(async (wallet?: string, nextOffset = 0) => {
    const target = wallet || address;
    if (!target) {
      setError("Connect the wallet that holds your credentials.");
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch<PageData>(`/api/students/${target}/credentials?offset=${nextOffset}&limit=10`);
      if (version !== requestVersion.current) return;
      setData(response);
      setOffset(nextOffset);
    } catch (err) {
      if (version === requestVersion.current) setError((err as Error).message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    const version = ++requestVersion.current;
    apiFetch<PageData>(`/api/students/${address}/credentials?offset=0&limit=10`, { signal: controller.signal })
      .then(response => {
        if (version !== requestVersion.current) return;
        setData(response);
        setOffset(0);
        setError("");
      })
      .catch(err => {
        if (!controller.signal.aborted && version === requestVersion.current) setError((err as Error).message);
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });
    return () => {
      controller.abort();
      if (version === requestVersion.current) requestVersion.current += 1;
    };
  }, [address]);
  const currentData = address && data && data.student.toLowerCase() === address.toLowerCase() ? data : null;
  const initialLoading = Boolean(address && !currentData && !error);

  return <div className="student-page-grid">
    <div className="student-main"><div className="workspace-intro"><span className="eyebrow"><span className="eyebrow-line" />STUDENT</span><h1>Your <em>credentials.</em></h1><p>Connect the wallet your institution used to view your records.</p></div>
      <div className="student-wallet-card"><div><small>WALLET</small><strong>{address ? shortAddress(address) : "Not connected"}</strong></div><button className="button button-dark button-small" onClick={() => void connect()}>{address ? "Change wallet" : "Connect wallet"}</button></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="credential-list-heading"><div><h2>Credentials</h2></div><button className="button button-outline button-small" onClick={() => void load()} disabled={!address || loading}>{loading ? "Loading…" : "Refresh"}</button></div>
      {(loading || initialLoading) && !currentData && <div className="empty-state">Loading your credentials…</div>}
      {!address && !loading && <div className="student-empty-panel"><div className="student-empty-illustration" aria-hidden="true"><div className="student-empty-sheet"><i /><i /><i /></div><span className="student-empty-seal">V</span></div><div className="student-empty-copy"><span>STUDENT ACCESS</span><h3>Your credentials start here.</h3><p>Connect the same wallet your institution used when issuing your certificate.</p><div className="student-empty-actions"><button className="button button-dark" onClick={() => void connect()}>Connect wallet <span className="button-arrow">↗</span></button></div></div></div>}
      {currentData && currentData.items.length === 0 && <div className="student-empty-panel"><div className="student-empty-illustration" aria-hidden="true"><div className="student-empty-sheet"><i /><i /><i /></div><span className="student-empty-seal">V</span></div><div className="student-empty-copy"><span>NO CREDENTIALS YET</span><h3>No records found.</h3><p>Check that this is the wallet your institution used. If it is, ask them to issue your certificate.</p><div className="student-empty-actions"><Link href="/" className="button button-outline">Back to home</Link></div></div></div>}
      {currentData && currentData.items.length > 0 && <div className="student-credentials">{currentData.items.map(item => <article className="student-credential" key={item.credentialId}><div className="credential-number">#{String(item.credentialId).padStart(4, "0")}</div><div className="student-credential-main"><strong>Credential #{String(item.credentialId).padStart(4, "0")}</strong><small>Issued by {shortAddress(item.issuer)} · {formatDate(item.issuedAt)}</small><code>{item.certificateHash.slice(0, 18)}…{item.certificateHash.slice(-8)}</code></div><span className={`status-pill ${item.status}`}>{item.status.replace("_", " ")}</span></article>)}</div>}
      {currentData && (offset > 0 || currentData.hasMore) && <div className="pagination"><button className="button button-outline button-small" disabled={offset === 0 || loading} onClick={() => void load(address || undefined, Math.max(0, offset - 10))}>Previous</button><span>{currentData.items.length ? `${offset + 1}–${offset + currentData.items.length}` : "No records"}</span><button className="button button-outline button-small" disabled={!currentData.hasMore || loading} onClick={() => void load(address || undefined, offset + 10)}>Next</button></div>}
    </div><aside className="student-aside"><div className="privacy-card"><span className="eyebrow">YOUR RECORD</span><strong>Your wallet holds the link.</strong><p>Your credentials are linked to your wallet. The original PDF is not stored on the blockchain.</p><Link href="/verify" className="student-aside-link">Verify a certificate ↗</Link></div><LiveActivity compact /></aside>
  </div>;
}
