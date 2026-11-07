import Link from "next/link";
import { CertificateVerifier } from "@/components/CertificateVerifier";

export default function VerifyPage() {
  return <main className="page-shell verify-route"><div className="page-hero compact-hero"><div className="eyebrow"><span className="eyebrow-line" />PUBLIC REGISTRY</div><h1>Verify a<br /><em>certificate.</em></h1><p>Upload the original file. No account or wallet is needed.</p><div className="hero-side-note"><span>SHA-256</span><small>EXACT FILE BYTES<br />ON-CHAIN LOOKUP</small></div></div><CertificateVerifier /><div className="page-footnote">Use the original file. A re-saved or scanned copy may have a different fingerprint. <Link href="/">Back to VeriDegree ↗</Link></div></main>;
}
