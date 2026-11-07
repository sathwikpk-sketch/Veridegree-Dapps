"use client";

import { Contract, Interface, isAddress, type InterfaceAbi } from "ethers";
import { useState } from "react";
import abi from "@/lib/VeriDegree.abi.json";
import { apiFetch, formatDate, shortAddress } from "@/lib/api";
import { CONTRACT_ADDRESS, DEMO_STUDENT_ADDRESS } from "@/lib/config";
import { validateCertificateFile } from "@/lib/certificate-file";
import { useWallet } from "@/context/WalletContext";
import { LiveActivity } from "@/components/LiveActivity";

type Credential = { credentialId: number; certificateHash: string; issuer: string; student: string; issuedAt: number; revoked: boolean; issuerApproved: boolean; status: string };

function errorText(error: unknown) {
  const e = error as { code?: number; shortMessage?: string; reason?: string; message?: string };
  if (e.code === 4001) return "Transaction rejected in MetaMask. No changes were made.";
  return e.shortMessage || e.reason || e.message || "Transaction failed. Check the wallet and network, then try again.";
}

export function InstitutionWorkspace() {
  const { address, signIn, session, getSigner, busy: walletBusy, error: walletError } = useWallet();
  const [student, setStudent] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [checkingFile, setCheckingFile] = useState(false);
  const [credentialId, setCredentialId] = useState("");
  const [lookup, setLookup] = useState<Credential | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  async function authenticate() {
    setBusy(true); setError(""); setNotice("");
    try {
      const auth = await signIn();
      if (auth.role !== "institution" && auth.role !== "admin") throw new Error("This wallet is not approved. Ask an administrator to approve it.");
      setNotice(auth.role === "admin" ? "Administrator signed in. Institution approval is still needed to issue credentials." : "Institution wallet verified.");
    } catch (err) { setError((err as Error).message || "Sign-in failed."); }
    finally { setBusy(false); }
  }

  async function loadDemoRecord() {
    setDemoLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/demo/veridegree-demo-certificate.pdf");
      if (!response.ok) throw new Error("The demonstration certificate could not be loaded. Refresh the page and try again.");
      const blob = await response.blob();
      const demoFile = new File([blob], "veridegree-demo-certificate.pdf", { type: "application/pdf", lastModified: Date.now() });
      const validationError = await validateCertificateFile(demoFile);
      if (validationError) throw new Error(validationError);
      setCertificate(demoFile);
      setDemoLoaded(true);
      const savedAddress = typeof window !== "undefined" ? window.localStorage.getItem("veridegree:demo-student-address") || "" : "";
      const configuredAddress = DEMO_STUDENT_ADDRESS || savedAddress;
      if (configuredAddress) {
        setStudent(configuredAddress);
        setNotice("Demo certificate and configured student wallet loaded. Review the recipient before issuing.");
      } else {
        setNotice("Demo certificate loaded. Add your separate student test-wallet address below, then issue when ready.");
      }
      const input = document.getElementById("credential-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) {
      setError((err as Error).message || "Could not load the demonstration certificate.");
    } finally {
      setDemoLoading(false);
    }
  }

  function updateStudentAddress(value: string) {
    setStudent(value);
    if (typeof window !== "undefined" && isAddress(value)) {
      window.localStorage.setItem("veridegree:demo-student-address", value);
    }
  }

  function removeCertificate() {
    setCertificate(null);
    setDemoLoaded(false);
    const input = document.getElementById("credential-file") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function selectCertificate(nextFile?: File) {
    setCertificate(null);
    setError("");
    if (!nextFile) return;
    setCheckingFile(true);
    try {
      const validationError = await validateCertificateFile(nextFile);
      if (validationError) {
        setError(validationError);
        const fileInput = document.getElementById("credential-file") as HTMLInputElement | null;
        if (fileInput) fileInput.value = "";
      } else {
        setCertificate(nextFile);
        setDemoLoaded(false);
      }
    } catch {
      setError("The selected file could not be read. Choose it again.");
    } finally {
      setCheckingFile(false);
    }
  }

  async function issueCredential() {
    setError(""); setNotice(""); setTransaction("");
    if (!session || session.role !== "institution") { setError("Issuance requires a currently approved institution wallet. Admin governance uses the separate 2-of-3 multisig flow."); return; }
    if (!certificate) { setError("Choose the exact certificate file to issue."); return; }
    if (!isAddress(student)) { setError("Enter a valid student wallet address."); return; }
    setBusy(true);
    try {
      const bytes = await certificate.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = `0x${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
      const signer = await getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, abi as InterfaceAbi, signer);
      setTransaction("Waiting for MetaMask approval…");
      const tx = await contract.issueCredential(hash, student);
      setTransaction(`Pending · ${tx.hash}`);
      const receipt = await tx.wait();
      const iface = new Interface(abi as InterfaceAbi);
      let issuedId: string | number = "confirmed";
      for (const log of receipt.logs) {
        try { const parsed = iface.parseLog(log); if (parsed?.name === "CredentialIssued") issuedId = Number(parsed.args.credentialId); } catch { /* Ignore logs from other contracts. */ }
      }
      setNotice(`Credential ${issuedId === "confirmed" ? "issued" : `#${issuedId} issued`} successfully. The transaction is confirmed on Sepolia.`);
      setTransaction(`Confirmed · ${tx.hash}`);
      if (typeof issuedId === "number") {
        setCredentialId(String(issuedId));
        try {
          const record = await apiFetch<Credential>(`/api/institution/credentials/${issuedId}`, {}, session.accessToken);
          setLookup(record);
        } catch {
          setLookup(null);
        }
      }
      setCertificate(null);
      setDemoLoaded(false);
      const fileInput = document.getElementById("credential-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (err) { setError(errorText(err)); setTransaction(""); }
    finally { setBusy(false); }
  }

  async function findCredential() {
    setError(""); setNotice(""); setLookup(null);
    if (!/^\d+$/.test(credentialId)) { setError("Enter a numeric credential ID."); return; }
    setBusy(true);
    try { const data = await apiFetch<Credential>(`/api/institution/credentials/${credentialId}`, {}, session?.accessToken); setLookup(data); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function revokeCredential() {
    setError(""); setNotice(""); setTransaction("");
    if (!session) { setError("Sign in before revoking credentials."); return; }
    if (!lookup) { setError("Look up a credential first."); return; }
    if (lookup.issuer.toLowerCase() !== address?.toLowerCase() || session.role !== "institution") { setError("Only the currently approved original issuer can directly revoke this credential. Admin emergency revocation uses the 2-of-3 multisig."); return; }
    if (lookup.revoked) { setError("This credential is already revoked."); return; }
    setBusy(true);
    try {
      const signer = await getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, abi as InterfaceAbi, signer);
      setTransaction("Waiting for MetaMask approval…");
      const tx = await contract.revokeCredential(lookup.credentialId);
      setTransaction(`Pending · ${tx.hash}`);
      await tx.wait();
      setNotice(`Credential #${lookup.credentialId} has been revoked on Sepolia.`);
      setTransaction(`Confirmed · ${tx.hash}`);
      await findCredential();
    } catch (err) { setError(errorText(err)); setTransaction(""); }
    finally { setBusy(false); }
  }

  return <div className="workspace-grid">
    <div className="workspace-main">
      <div className="workspace-intro"><span className="eyebrow"><span className="eyebrow-line" />INSTITUTION</span><h1>Issue and manage<br /><em>credentials.</em></h1><p>Create certificate records for students and manage the records your institution has issued.</p></div>
      <div className="session-card">
        <div className="session-led"><span className={`status-led ${session ? "active" : ""}`} /></div>
        <div className="session-info"><strong>{session ? "Wallet signed in" : "Sign in to continue"}</strong><small>{session ? `${shortAddress(session.address)} · ${session.role}` : address ? "Wallet connected. Sign in to continue." : "Connect an approved institution wallet."}</small></div>
        <button className="button button-outline button-small" onClick={() => void authenticate()} disabled={busy || walletBusy}>{busy || walletBusy ? "Please wait…" : session ? "Refresh" : "Sign in"}</button>
      </div>
      {(error || walletError) && <div className="alert alert-error">{error || walletError}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {transaction && <div className="transaction-state"><span className="transaction-dot" />{transaction}</div>}
      <div className="form-card">
        <div className="card-kicker">NEW CREDENTIAL</div><h2>Issue a certificate</h2><p>Enter the student wallet and choose the original certificate file.</p>
        <div className="institution-demo-box">
          <div className="institution-demo-copy"><span>DEMO CERTIFICATE</span><b>Northline Institute · Aarav Mehta</b><small>Fictional sample · Applied Computing</small></div>
          <button type="button" className="button-demo" onClick={() => void loadDemoRecord()} disabled={demoLoading || busy}>{demoLoading ? "Loading…" : demoLoaded ? "Reload demo" : "Load demo"}</button>
        </div>
        <label className="field-label" htmlFor="student-wallet">Student wallet</label>
        <input id="student-wallet" className="field-input" placeholder="0x… Student wallet address" value={student} onChange={e => updateStudentAddress(e.target.value)} spellCheck={false} />
        <small className="demo-address-help">Use the student&apos;s separate Sepolia test wallet.</small>
        <label className="field-label" htmlFor="credential-file">Certificate file</label>
        <input id="credential-file" className="field-input file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e => { void selectCertificate(e.target.files?.[0]); }} />
        {certificate && <div className="selected-certificate"><span className="selected-certificate-mark">✓</span><div><b>{certificate.name}</b><small>{(certificate.size / 1024).toFixed(1)} KB · {demoLoaded ? "DEMONSTRATION FILE" : "READY TO HASH"}</small></div><button type="button" onClick={removeCertificate} aria-label="Remove selected certificate">×</button></div>}
        <div className="form-footnote">SHA-256 fingerprint · PDF is not stored on-chain</div>
        <button className="button button-dark" onClick={() => void issueCredential()} disabled={busy || checkingFile || session?.role !== "institution" || !student || !certificate}>{checkingFile ? "Checking file…" : busy ? "Processing…" : "Issue certificate"}<span className="button-arrow">↗</span></button>
        {!session && <small className="muted-note">Sign in with an approved institution wallet to continue.</small>}
      </div>
      <div className="form-card">
        <div className="card-kicker">MANAGE</div><h2>Find a certificate</h2><p>Enter its credential ID to view or revoke the record.</p>
        <label className="field-label" htmlFor="lookup-credential-id">Credential ID</label><div className="inline-field"><input id="lookup-credential-id" className="field-input" placeholder="Enter credential ID" value={credentialId} onChange={e => setCredentialId(e.target.value)} inputMode="numeric" /><button className="button button-outline" onClick={() => void findCredential()} disabled={busy || !session}>Search</button></div>
        {lookup && <div className="record-preview"><div className="record-preview-top"><strong>Credential #{lookup.credentialId}</strong><span className={`status-pill ${lookup.status}`}>{lookup.status.replace("_", " ")}</span></div><div className="record-detail"><span>Student</span><b>{shortAddress(lookup.student)}</b></div><div className="record-detail"><span>Issued</span><b>{formatDate(lookup.issuedAt)}</b></div><div className="record-detail"><span>Issuer approved</span><b>{lookup.issuerApproved ? "Yes" : "No"}</b></div><button className="button button-danger" onClick={() => void revokeCredential()} disabled={busy || lookup.revoked || !session}>Revoke credential</button></div>}
      </div>
    </div>
    <aside className="workspace-aside"><div className="aside-note"><span className="eyebrow"><span className="eyebrow-line" />INSTITUTION ACCESS</span><h3>Your wallet.<br /><em>Your control.</em></h3><p>Sign in with an approved wallet. Review each transaction in MetaMask before confirming.</p><div className="aside-stat"><span>01</span><b>Connect</b><small>Connect MetaMask.</small></div><div className="aside-stat"><span>02</span><b>Sign in</b><small>We check institution approval.</small></div><div className="aside-stat"><span>03</span><b>Confirm</b><small>Review the transaction.</small></div></div><LiveActivity compact /></aside>
  </div>;
}
