import Link from "next/link";
import { CertificateVerifier } from "@/components/CertificateVerifier";
import { VerificationInstrument } from "@/components/VerificationInstrument";
import { CredentialStory } from "@/components/CredentialStory";
import { LiveActivity } from "@/components/LiveActivity";
import { ScrollReveal } from "@/components/ScrollReveal";
import { DemoRail } from "@/components/DemoRail";

const sections = [
  { id: "intro", label: "The record" },
  { id: "journey", label: "How it travels" },
  { id: "roles", label: "Who uses it" },
  { id: "verify-now", label: "Verify a file" },
  { id: "registry", label: "What is recorded" },
  { id: "activity", label: "Network activity" },
];

export default function HomePage() {
  return (
    <main className="home-v5">
      <DemoRail items={sections} />

      <section className="hero-wrap immersive-hero" id="intro">
        <div className="hero-ambient" aria-hidden="true"><span /><span /><span /></div>
        <div className="hero-content">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="kicker-dot" />ACADEMIC RECORDS, MADE VERIFIABLE</div>
            <p className="hero-index">VERIDEGREE / PUBLIC CREDENTIAL REGISTRY</p>
            <h1>A qualification<br />should travel<br /><em>with its proof.</em></h1>
            <p className="hero-subtitle">Issue a credential once. Let a student carry its record, and let an employer check it without a phone call.</p>
            <div className="hero-actions">
              <Link href="/verify" className="button button-light">Verify a certificate <span className="button-arrow">↗</span></Link>
              <Link href="/institution" className="text-link light-link">For institutions <span>→</span></Link>
            </div>
            <div className="hero-proofline"><span className="proof-icon">●</span><span>ETHEREUM SEPOLIA</span><span className="proof-separator" /><span>INSTITUTIONS KEEP THEIR KEYS</span></div>
          </div>
          <VerificationInstrument />
        </div>
        <div className="hero-bottom"><span>01 — THE CREDENTIAL</span><a className="scroll-cue" href="#journey">FOLLOW THE RECORD <i>↓</i></a><span>ISSUE · CARRY · VERIFY</span></div>
      </section>

      <CredentialStory />

      <ScrollReveal>
        <section className="roles-section page-pad" id="roles">
          <div className="roles-heading"><div><span className="eyebrow"><span className="eyebrow-line" />BUILT AROUND THREE PEOPLE</span><h2>One record.<br /><em>Three points of view.</em></h2></div><p>Each person gets the part of the process they need. No one has to learn how to use a blockchain explorer.</p></div>
          <div className="roles-grid">
            <Link href="/institution" className="role-card role-card-dark"><span className="role-number">01 / INSTITUTION</span><div className="role-symbol role-symbol-seal">V</div><h3>Issue with<br />authority.</h3><p>Approved institutions register and manage the credentials they have issued, using their own wallet.</p><span className="role-link">OPEN INSTITUTION WORKSPACE <b>↗</b></span></Link>
            <Link href="/student" className="role-card"><span className="role-number">02 / STUDENT</span><div className="role-symbol role-symbol-record">▤</div><h3>Your record,<br />within reach.</h3><p>Students connect the wallet associated with their credentials and view their public record history.</p><span className="role-link">VIEW STUDENT RECORD <b>↗</b></span></Link>
            <Link href="/verify" className="role-card"><span className="role-number">03 / EMPLOYER</span><div className="role-symbol role-symbol-check">✓</div><h3>Check the file.<br />Not the promise.</h3><p>Employers upload the original certificate and review its registry match, revocation state and issuer approval.</p><span className="role-link">VERIFY A CERTIFICATE <b>↗</b></span></Link>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="verify-home-section page-pad" id="verify-now">
          <div className="verify-home-top"><div><span className="eyebrow"><span className="eyebrow-line" />PUBLIC VERIFICATION</span><h2>Put a certificate<br /><em>to the test.</em></h2></div><p>No account is needed. Choose the original file and VeriDegree will check its fingerprint against the Sepolia registry.</p></div>
          <CertificateVerifier />
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="registry-section page-pad" id="registry">
          <div className="registry-copy"><span className="eyebrow eyebrow-on-dark"><span className="eyebrow-line" />WHAT THE CONTRACT KEEPS</span><h2>The document<br />stays yours.<br /><em>The proof stays public.</em></h2><p>The original PDF is not written to the blockchain. VeriDegree records a SHA-256 fingerprint and the minimum information needed to verify the credential later.</p><Link href="/verify" className="text-link light-link">See how verification works <span>↗</span></Link></div>
          <div className="registry-flow">
            <div className="registry-flow-row"><span className="registry-flow-index">01</span><div className="registry-flow-icon registry-file-icon">PDF</div><div><b>Original certificate</b><small>Remains with the student or institution.</small></div><span className="registry-flow-state">OFF-CHAIN</span></div>
            <div className="registry-flow-connector"><i /></div>
            <div className="registry-flow-row"><span className="registry-flow-index">02</span><div className="registry-flow-icon registry-hash-icon">#</div><div><b>SHA-256 fingerprint</b><small>Calculated from the exact file bytes.</small></div><span className="registry-flow-state">32 BYTES</span></div>
            <div className="registry-flow-connector"><i /></div>
            <div className="registry-flow-row"><span className="registry-flow-index">03</span><div className="registry-flow-icon registry-chain-icon">◈</div><div><b>Sepolia registry</b><small>Issuer, student wallet, issue time and status.</small></div><span className="registry-flow-state">ON-CHAIN</span></div>
            <div className="registry-flow-foot"><span>NO CERTIFICATE FILE STORAGE</span><span>PUBLICLY CHECKABLE</span></div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="activity-section page-pad" id="activity">
          <div className="activity-intro"><span className="eyebrow"><span className="eyebrow-line" />THE REGISTRY, IN REAL TIME</span><h2>Every action<br />leaves a <em>record.</em></h2><p>Confirmed issuance, revocation and institution changes are read from contract events and shared with the page as they arrive.</p><span className="activity-network-note"><i /> ETHEREUM / SEPOLIA · LIVE EVENT STREAM</span></div>
          <LiveActivity />
        </section>
      </ScrollReveal>

      <section className="closing-cta" id="get-started"><span className="eyebrow eyebrow-on-dark"><span className="eyebrow-line" />VERIDEGREE / CREDENTIAL REGISTRY</span><h2>Make the proof<br /><em>easy to check.</em></h2><p>A public check for the employer. A record for the student. Control stays with the institution.</p><div className="closing-actions"><Link href="/verify" className="button button-light">Verify a certificate <span className="button-arrow">↗</span></Link><Link href="/institution" className="button button-outline-light">Issue a credential <span className="button-arrow">↗</span></Link></div><span className="closing-note">PUBLIC VERIFICATION NEEDS NO WALLET · INSTITUTIONS SIGN WITH METAMASK</span></section>
    </main>
  );
}
