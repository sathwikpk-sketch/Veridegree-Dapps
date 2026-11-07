"use client";

import { useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { validateCertificateFile } from "@/lib/certificate-file";

type Verification = {
  status: "valid" | "revoked" | "issuer_unapproved" | "not_found";
  credentialId?: number;
  certificateHash: string;
  issuer?: string;
  student?: string;
  issuedAt?: number;
  issuerApproved?: boolean;
  message: string;
  filename: string;
};

export function CertificateVerifier() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function selectCertificate(nextFile?: File) {
    setResult(null);
    setError("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    const validationError = await validateCertificateFile(nextFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(nextFile);
  }

  async function verify() {
    if (!file) { setError("Choose the original certificate file first."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`${API_BASE}/api/verify/upload`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Verification request failed.");
      setResult(data as Verification);
    } catch (err) { setError((err as Error).message || "Could not verify this file."); }
    finally { setBusy(false); }
  }

  return <section className="verify-panel" id="verify-panel">
    <div className="verify-copy">
      <span className="eyebrow"><span className="eyebrow-line" />PUBLIC VERIFICATION</span>
      <h2>Proof, without the paperwork.</h2>
      <p>Drop the original certificate file. VeriDegree checks its SHA-256 fingerprint against the Sepolia registry and reports the credential’s live status.</p>
      <div className="privacy-note"><span className="privacy-icon">◇</span><span><strong>Your document stays yours.</strong><br />The file is hashed in memory for this request and is not stored by the application.</span></div>
    </div>
    <div className="upload-card">
      <label
        htmlFor="verify-certificate-file"
        className={`drop-zone ${file ? "has-file" : ""}`}
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          void selectCertificate(event.dataTransfer.files?.[0]);
        }}
      >
        <input ref={inputRef} id="verify-certificate-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" hidden onChange={event => { void selectCertificate(event.target.files?.[0]); }} />
        <span className="upload-glyph">↑</span>
        <strong>{file ? file.name : "Choose your certificate"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace` : "Drop a file here or browse your device"}</span>
        <small>PDF, JPG or PNG · Up to 12 MB</small>
      </label>
      <button className="button button-dark button-full" onClick={() => void verify()} disabled={!file || busy}>{busy ? <><span className="spinner" /> Checking the chain…</> : "Verify certificate"}<span className="button-arrow">↗</span></button>
      <a className="sample-certificate-link" href="/demo/veridegree-demo-certificate.pdf" download>Download sample certificate <span>↘</span></a>
      {error && <p className="form-error">{error}</p>}
      {result && <div className={`verification-result result-${result.status}`} aria-live="polite">
        <div className="result-top"><span className="result-symbol">{result.status === "valid" ? "✓" : result.status === "not_found" ? "?" : "!"}</span><div><small>VERIFICATION RESULT</small><strong>{result.status === "valid" ? "Valid credential" : result.status === "revoked" ? "Credential revoked" : result.status === "issuer_unapproved" ? "Issuer not currently approved" : "No record found"}</strong></div></div>
        <p>{result.message}</p>
        {typeof result.credentialId === "number" && <div className="result-meta"><span>Credential <b>#{result.credentialId}</b></span><span>Issuer <b>{result.issuer?.slice(0, 8)}…{result.issuer?.slice(-5)}</b></span></div>}
        <code>{result.certificateHash}</code>
      </div>}
    </div>
  </section>;
}
