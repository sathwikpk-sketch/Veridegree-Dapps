"use client";

import { useState } from "react";

const journeys = [
  {
    id: "issue", number: "01", role: "INSTITUTION", title: "Issue with authority.",
    text: "An approved institution connects its wallet, signs a one-time login challenge, and submits the certificate fingerprint. The institution signs the transaction; VeriDegree never takes custody of its key.",
    steps: ["Connect the institution wallet", "Sign the authentication challenge", "Hash the original file with SHA-256", "Confirm issuance in MetaMask"],
    outcome: "A credential record is anchored on Sepolia.", mark: "↗",
  },
  {
    id: "carry", number: "02", role: "STUDENT", title: "Carry your record.",
    text: "A student uses the wallet address associated with their credentials to retrieve the on-chain record. The original certificate remains with the student, not in a central document vault.",
    steps: ["Connect the wallet holding the credential", "Read the credential IDs linked to it", "Inspect issuer, issue date and status", "Keep the original certificate file private"],
    outcome: "The student can inspect their credential history.", mark: "◇",
  },
  {
    id: "verify", number: "03", role: "EMPLOYER / PUBLIC", title: "Verify in moments.",
    text: "An employer uploads the original certificate. The browser sends the file to the verification API, which calculates its SHA-256 fingerprint and checks the registry and current issuer approval.",
    steps: ["Choose the original certificate file", "Calculate the exact-file SHA-256 digest", "Find the matching on-chain record", "Review revocation and issuer approval separately"],
    outcome: "A clear result: valid, revoked, issuer not approved, or not found.", mark: "✓",
  },
];

export function JourneyExplorer() {
  const [active, setActive] = useState("issue");
  const current = journeys.find(item => item.id === active) ?? journeys[0];

  return (
    <div className="journey-explorer">
      <div className="journey-tabs" role="tablist" aria-label="Explore the VeriDegree workflow">
        {journeys.map(item => (
          <button key={item.id} type="button" role="tab" aria-selected={active === item.id} aria-controls="journey-panel" className={`journey-tab ${active === item.id ? "active" : ""}`} onClick={() => setActive(item.id)}>
            <span>{item.mark}</span><strong>{item.role}</strong><i>↗</i>
          </button>
        ))}
      </div>
      <div className="journey-panel" id="journey-panel" role="tabpanel" key={current.id}>
        <div className="journey-panel-copy">
          <span className="journey-overline">THE {current.role} ROLE</span>
          <h3>{current.title}</h3>
          <p>{current.text}</p>
          <div className="journey-outcome"><span>THE OUTCOME</span><strong>{current.outcome}</strong></div>
        </div>
        <div className="journey-steps">
          <div className="journey-steps-head"><span>THE SEQUENCE</span><span>0{current.steps.length} STEPS</span></div>
          {current.steps.map((step, index) => (
            <div className="journey-step" key={`${current.id}-${step}`} style={{ animationDelay: `${index * 70}ms` }}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong><i>↗</i>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
