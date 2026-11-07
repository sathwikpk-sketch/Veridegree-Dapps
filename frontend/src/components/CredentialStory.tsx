"use client";

import { Fragment, useEffect, useRef, useState } from "react";

function WordRevealText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\s+/).map((word, index) => (
        <span className="story-word" data-story-word="true" aria-hidden="true" key={`${word}-${index}`}>
          {word}
        </span>
      ))}
    </>
  );
}

const chapters = [
  {
    id: "issued",
    number: "01",
    eyebrow: "THE INSTITUTION",
    title: "It begins with an original document.",
    body: "An approved institution selects the certificate and submits it from its own wallet. The original file stays with its owner; the institution approves the transaction in MetaMask.",
    note: "ISSUED BY AN APPROVED INSTITUTION",
  },
  {
    id: "registered",
    number: "02",
    eyebrow: "THE REGISTRY",
    title: "A fingerprint becomes the record.",
    body: "VeriDegree calculates SHA-256 from the exact file bytes. The contract records that digest with the issuer, student wallet, issue time and revocation state on Sepolia.",
    note: "A UNIQUE FINGERPRINT, RECORDED ON-CHAIN",
  },
  {
    id: "checked",
    number: "03",
    eyebrow: "THE EMPLOYER",
    title: "The file can answer for itself.",
    body: "An employer uploads the original certificate. VeriDegree recalculates its fingerprint, finds the matching record and displays revocation and issuer approval as separate checks.",
    note: "PUBLIC VERIFICATION · NO WALLET REQUIRED",
  },
];

function SceneVisual({ active }: { active: number }) {
  return (
    <div className={`story-visual story-visual-${active}`} key={active} aria-label="Illustration of the credential lifecycle">
      <div className="story-visual-top"><span><i /> CREDENTIAL LIFECYCLE</span><span>DEMONSTRATION</span></div>
      {active === 0 && (
        <div className="story-document-scene">
          <div className="story-document-shadow" />
          <div className="story-document">
            <div className="story-document-brand"><span>V</span><b>VERIDEGREE</b><small>RECORD SPECIMEN</small></div>
            <div className="story-document-rule" />
            <small className="story-document-label">CERTIFICATE OF COMPLETION</small>
            <h3>Aarav Mehta</h3>
            <p>Applied Computing<br />Product Systems · 2026</p>
            <div className="story-document-seal">✳</div>
            <div className="story-document-foot"><span>NORTHLINE INSTITUTE · DEMO</span><span>01 / 03</span></div>
            <span className="story-watermark">SAMPLE</span>
          </div>
          <div className="story-side-tag">ORIGINAL FILE<br /><b>PDF · 1.2 MB</b></div>
          <div className="story-scan-line" />
        </div>
      )}
      {active === 1 && (
        <div className="story-hash-scene">
          <div className="hash-source"><span className="hash-file-icon">PDF</span><div><b>certificate.pdf</b><small>Exact file bytes</small></div><span className="hash-arrow">→</span></div>
          <div className="hash-processing"><span>SHA-256 FINGERPRINT</span><div className="hash-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><code>0x7f3a9c0e1b8d2f45…d3f2186</code></div>
          <div className="hash-ledger"><div className="ledger-block"><span>BLOCK 01</span><b>ISSUER</b><small>Institution wallet</small></div><i className="ledger-link" /><div className="ledger-block ledger-block-active"><span>BLOCK 02</span><b>FINGERPRINT</b><small>Stored on Sepolia</small></div><i className="ledger-link" /><div className="ledger-block"><span>BLOCK 03</span><b>STATUS</b><small>Revocable record</small></div></div>
          <div className="story-visual-footnote">THE PDF IS NOT STORED ON THE BLOCKCHAIN</div>
        </div>
      )}
      {active === 2 && (
        <div className="story-verify-scene">
          <div className="verify-window-bar"><span /><span /><span /><small>PUBLIC VERIFICATION</small></div>
          <div className="verify-window-body">
            <div className="verify-window-heading"><span>DOCUMENT CHECK</span><b>SPECIMEN</b></div>
            <div className="verify-file-row"><span className="verify-pdf">PDF</span><div><b>certificate.pdf</b><small>Uploaded by verifier</small></div><span className="verify-check">✓</span></div>
            <div className="verify-check-row"><span>Fingerprint match</span><b>CONFIRMED</b></div>
            <div className="verify-check-row"><span>Revocation status</span><b>NOT REVOKED</b></div>
            <div className="verify-check-row"><span>Issuer approval</span><b>APPROVED</b></div>
            <div className="verify-result-stamp"><span>✓</span><div><b>RECORD MATCHED</b><small>ILLUSTRATIVE RESULT · NOT A LIVE LOOKUP</small></div></div>
          </div>
          <div className="verify-window-note">ONE FILE · THREE INDEPENDENT CHECKS</div>
        </div>
      )}
      <div className="story-visual-index"><span>VERIDEGREE</span><span>0{active + 1} / 03</span></div>
    </div>
  );
}

export function CredentialStory() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const nodes = stepRefs.current.filter((node): node is HTMLElement => node instanceof HTMLElement);
    const story = document.querySelector<HTMLElement>(".credential-story-section");
    if (!nodes.length || !story) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    let frame = 0;

    // Reveal one word at a time as its chapter moves through the reading zone.
    // The text remains present in the document and fully readable without JS.
    const updateWordProgress = () => {
      frame = 0;
      if (reducedMotion) return;
      const viewportHeight = window.innerHeight || 1;
      const revealTargets = [
        ...Array.from(story.querySelectorAll<HTMLElement>("[data-story-reveal]")),
      ];

      revealTargets.forEach((target) => {
        const rect = target.getBoundingClientRect();
        const start = viewportHeight * 0.86;
        const end = viewportHeight * 0.36;
        const progress = clamp((start - rect.top) / (start - end));
        const words = target.querySelectorAll<HTMLElement>("[data-story-word]");
        const count = words.length;

        words.forEach((word, index) => {
          const wordProgress = clamp(progress * count - index);
          const opacity = 0.24 + wordProgress * 0.76;
          const lift = (1 - wordProgress) * 12;
          const blur = (1 - wordProgress) * 0.9;
          word.style.opacity = opacity.toFixed(3);
          word.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0)`;
          word.style.filter = `blur(${blur.toFixed(2)}px)`;
        });
      });
    };

    const scheduleWordProgress = () => {
      if (!frame) frame = window.requestAnimationFrame(updateWordProgress);
    };

    updateWordProgress();
    window.addEventListener("scroll", scheduleWordProgress, { passive: true });
    window.addEventListener("resize", scheduleWordProgress);

    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const index = nodes.indexOf(visible.target as HTMLElement);
          if (index >= 0) setActive(index);
        }
      }, { rootMargin: "-34% 0px -34% 0px", threshold: [0.05, 0.2, 0.45, 0.7] });
      nodes.forEach((node) => observer?.observe(node));
    }

    return () => {
      window.removeEventListener("scroll", scheduleWordProgress);
      window.removeEventListener("resize", scheduleWordProgress);
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return (
    <section className="credential-story-section" id="journey">
      <div className="story-heading">
        <div data-story-reveal><span className="eyebrow eyebrow-on-dark"><span className="eyebrow-line" />A RECORD, FROM START TO CHECK</span><h2 className="story-heading-words" aria-label="One certificate. A longer life."><span><WordRevealText text="One certificate." /></span><br /><em><WordRevealText text="A longer life." /></em></h2></div>
        <p>The experience changes for each person. The record underneath stays consistent.</p>
      </div>
      <nav className="story-progress-nav" aria-label="Credential journey steps">
        {chapters.map((chapter, index) => (
          <Fragment key={chapter.id}>
            <button
              type="button"
              className="story-progress-button"
              aria-current={active === index ? "step" : undefined}
              onClick={() => {
                setActive(index);
                const node = stepRefs.current[index];
                const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                node?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
              }}
            >
              <span>{chapter.number}</span>{chapter.eyebrow === "THE REGISTRY" ? "Register" : chapter.eyebrow === "THE EMPLOYER" ? "Verify" : "Issue"}
            </button>
            {index < chapters.length - 1 && <span className="story-progress-track" aria-hidden="true" />}
          </Fragment>
        ))}
      </nav>
      <div className="story-layout">
        <div className="story-chapters">
          {chapters.map((chapter, index) => (
            <article className={`story-chapter ${active === index ? "is-active" : ""}`} key={chapter.id} ref={node => { stepRefs.current[index] = node; }}>
              <div className="story-chapter-number">{chapter.number}<span /></div>
              <div className="story-chapter-copy" data-story-reveal><span>{chapter.eyebrow}</span><h3 className="story-word-reveal" aria-label={chapter.title}><WordRevealText text={chapter.title} /></h3><p>{chapter.body}</p><small>{chapter.note}</small></div>
              <div className="story-mobile-visual" aria-hidden="true"><SceneVisual active={index} /></div>
            </article>
          ))}
        </div>
        <div className="story-stage-wrap">
          <div className="story-stage-sticky"><SceneVisual active={active} /></div>
        </div>
      </div>
      <div className="story-bottomline"><span>FROM DOCUMENT TO FINGERPRINT TO PUBLIC RECORD</span><span>SCROLL TO FOLLOW THE RECORD ↓</span></div>
    </section>
  );
}
