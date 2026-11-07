"use client";

import { useRef, type PointerEvent } from "react";

/**
 * Hero object: a fictional, clearly labelled specimen credential.
 * It is a visual explanation of the product, not a live on-chain result.
 */
export function VerificationInstrument() {
  const objectRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !objectRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    objectRef.current.style.setProperty("--tilt-x", `${-y * 5}deg`);
    objectRef.current.style.setProperty("--tilt-y", `${x * 6}deg`);
  }

  function resetPointer() {
    objectRef.current?.style.setProperty("--tilt-x", "0deg");
    objectRef.current?.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div className="credential-hero-art" onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
      <div className="credential-art-index"><span>VERIDEGREE / SPECIMEN 001</span><span>ACADEMIC RECORD</span></div>
      <div className="credential-art-halo" aria-hidden="true" />
      <div className="credential-art-back" aria-hidden="true"><span>V</span></div>
      <div className="credential-art-object" ref={objectRef}>
        <div className="specimen-paper">
          <div className="specimen-topline"><span className="specimen-mark">V</span><div><b>VERIDEGREE</b><small>DEMONSTRATION REGISTRY</small></div><span className="specimen-seal">✳</span></div>
          <div className="specimen-rule" />
          <div className="specimen-kicker">CERTIFICATE OF COMPLETION</div>
          <h2>A record<br />of achievement.</h2>
          <p className="specimen-recipient">Aarav Mehta</p>
          <p className="specimen-course">Applied Computing<br />Product Systems · 2026</p>
          <div className="specimen-signatures"><span><b>Northline Institute</b><small>DEMONSTRATION ISSUER</small></span><span className="specimen-signature">V / D</span></div>
          <div className="specimen-bottomline"><span>SPECIMEN · NOT A REAL QUALIFICATION</span><span>SEPOLIA / 11155111</span></div>
          <div className="specimen-watermark">SAMPLE</div>
        </div>
        <div className="specimen-shadow" aria-hidden="true" />
      </div>
      <div className="credential-art-caption"><span className="caption-line" /><span>THE DOCUMENT STAYS WITH ITS OWNER</span></div>
      <div className="credential-art-stamp"><span>01</span><b>ISSUE</b><small>RECORD CREATED</small></div>
      <div className="credential-art-foot"><span>ILLUSTRATIVE OBJECT</span><span>MOVE TO EXPLORE ↗</span></div>
    </div>
  );
}
