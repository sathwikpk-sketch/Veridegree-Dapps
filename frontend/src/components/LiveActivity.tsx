"use client";

import { useEffect, useState } from "react";
import { API_BASE, CONTRACT_ADDRESS, WS_URL } from "@/lib/config";

type FeedEvent = { type: string; blockNumber?: number; transactionHash?: string; args?: Record<string, string | number> };

function describeEvent(event: FeedEvent): string {
  const args = event.args || {};
  if (event.type === "CredentialIssued") return `Credential #${args.credentialId} issued to ${(String(args.student || "")).slice(0, 8)}…`;
  if (event.type === "CredentialRevoked") return `Credential #${args.credentialId} revoked${String(args.revokedBy || "").toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ? " by admin multisig" : ""}`;
  if (event.type === "InstitutionAdded") return `Institution ${(String(args.institution || "")).slice(0, 8)}… approved`;
  if (event.type === "InstitutionRemoved") return `Institution ${(String(args.institution || "")).slice(0, 8)}… removed`;
  if (event.type === "CredentialStudentUpdated") return `Credential #${args.credentialId} moved to a new wallet`;
  if (event.type === "AdminReplaced") return "Administrator wallet updated";
  return event.type;
}

export function LiveActivity({ compact = false }: { compact?: boolean }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout>;
    let active = true;
    void fetch(`${API_BASE}/api/events?limit=5`)
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (active && data?.items) setEvents(data.items as FeedEvent[]); })
      .catch(() => undefined);
    const connect = () => {
      if (!active) return;
      socket = new WebSocket(WS_URL);
      socket.onopen = () => { setConnected(true); setHasAttempted(true); };
      socket.onclose = () => { setConnected(false); setHasAttempted(true); if (active) reconnect = setTimeout(connect, 3500); };
      socket.onerror = () => socket?.close();
      socket.onmessage = message => {
        try {
          const event = JSON.parse(message.data) as FeedEvent & { rewoundToBlock?: number };
          if (event.type === "ChainReorg") {
            void fetch(`${API_BASE}/api/events?limit=5`)
              .then(response => response.ok ? response.json() : null)
              .then(data => { if (active && data?.items) setEvents(data.items as FeedEvent[]); })
              .catch(() => undefined);
            return;
          }
          if (!["Heartbeat", "Connected"].includes(event.type)) setEvents(previous => [event, ...previous].slice(0, 5));
        } catch { /* Ignore malformed socket messages. */ }
      };
    };
    connect();
    return () => { active = false; clearTimeout(reconnect); socket?.close(); };
  }, []);

  return <div className={`activity-card ${compact ? "activity-compact" : ""}`}>
    <div className="activity-heading"><div><span className="eyebrow"><span className="eyebrow-line" />ACTIVITY</span><h3>Recent updates</h3></div><span className={`connection-state ${connected ? "online" : "offline"}`}><i />{connected ? "Live" : hasAttempted ? "Offline" : "Connecting"}</span></div>
    {events.length ? <div className="activity-list">{events.map((event, index) => <div className="activity-row" key={`${event.transactionHash || event.type}-${event.blockNumber}-${index}`}><span className="activity-dot" /><div><strong>{describeEvent(event)}</strong><small>Block {event.blockNumber ?? "—"} · {event.transactionHash ? `${event.transactionHash.slice(0, 10)}…` : "Listening for events"}</small></div><span className="activity-kind">{event.type.replace("Credential", "Cred.").replace("Institution", "Inst.")}</span></div>)}</div> : <div className="empty-activity"><span className="pulse-ring" /><p>{connected ? "No recent updates. New confirmed activity will appear here." : "Connecting to Sepolia…"}</p></div>}
  </div>;
}
