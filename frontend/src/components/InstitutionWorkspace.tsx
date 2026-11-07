
  "use client";

  import { Contract, Interface, isAddress, type InterfaceAbi } from "ethers";
  import { useState } from "react";
  import abi from "@/lib/VeriDegree.abi.json";
  import { apiFetch, formatDate, shortAddress } from "@/lib/api";
  import { CONTRACT_ADDRESS, DEMO_STUDENT_ADDRESS } from "@/lib/config";
  import { validateCertificateFile } from "@/lib/certificate-file";
  import { useWallet } from "@/context/WalletContext";
  import { LiveActivity } from "@/components/LiveActivity";

  type Credential = {
    credentialId: number;
    certificateHash: string;
    issuer: string;
    student: string;
    issuedAt: number;
    revoked: boolean;
    issuerApproved: boolean;
    status: string;
  };

  const NORTHLINE_ADDRESS = "0xD700770Ff2C42b1C98409260CdD4B147a3B0B547";
  const ADMIN_1 = "0xffA323B98807Ce818FFae363f693A97315a7bc2a";
  const ADMIN_2 = "0x940072897C4d6a002AE3230ebB9c0f97B6D1c440";
  const SEPOLIA_CHAIN_ID = 11155111;

  function errorText(error: unknown) {
    const e = error as {
      code?: number;
      shortMessage?: string;
      reason?: string;
      message?: string;
    };

    if (e.code === 4001) {
      return "Transaction rejected in MetaMask. No changes were made.";
    }

    return (
      e.shortMessage ||
      e.reason ||
      e.message ||
      "Transaction failed. Check the wallet and network, then try again."
    );
  }

  export function InstitutionWorkspace() {
    const {
      address,
      signIn,
      session,
      getSigner,
      busy: walletBusy,
      error: walletError,
    } = useWallet();

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

    // Admin governance state
    const [proposalId, setProposalId] = useState("0");
    const [governanceBusy, setGovernanceBusy] = useState(false);
    const [governanceNotice, setGovernanceNotice] = useState("");
    const [governanceError, setGovernanceError] = useState("");

    const isAdmin1 = address?.toLowerCase() === ADMIN_1.toLowerCase();
    const isAdmin2 = address?.toLowerCase() === ADMIN_2.toLowerCase();

    // Authenticate wallet
    async function authenticate() {
      setBusy(true);
      setError("");
      setNotice("");

      try {
        const auth = await signIn();

        if (auth.role !== "institution" && auth.role !== "admin") {
          throw new Error(
            "This wallet is not approved. Ask an administrator to approve it."
          );
        }

        setNotice(
          auth.role === "admin"
            ? "Administrator signed in. Institution approval is still needed to issue credentials."
            : "Institution wallet verified."
        );
      } catch (err) {
        setError((err as Error).message || "Sign-in failed.");
      } finally {
        setBusy(false);
      }
    }

    // Admin 1: Create Northline approval proposal
    async function createNorthlineProposal() {
      setGovernanceBusy(true);
      setGovernanceError("");
      setGovernanceNotice("");

      try {
        if (!address || !isAdmin1) {
          throw new Error("Connect Admin 1's wallet first.");
        }

        const signer = await getSigner();
        const signerAddress = await signer.getAddress();

        if (signerAddress.toLowerCase() !== ADMIN_1.toLowerCase()) {
          throw new Error("The connected wallet is not Admin 1.");
        }

        const provider = signer.provider;

        if (!provider) {
          throw new Error("MetaMask provider is unavailable.");
        }

        const network = await provider.getNetwork();

        if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
          throw new Error("Please connect MetaMask to Sepolia.");
        }

        const contract = new Contract(
          CONTRACT_ADDRESS,
          abi as InterfaceAbi,
          signer
        );

        const alreadyApproved = await contract.approvedInstitutions(
          NORTHLINE_ADDRESS
        );

        if (alreadyApproved) {
          throw new Error("Northline Institute is already approved.");
        }

        const nextId = await contract.nextProposalId();

        const actionInterface = new Interface([
          "function addInstitution(address institution)",
        ]);

        const actionData = actionInterface.encodeFunctionData(
          "addInstitution",
          [NORTHLINE_ADDRESS]
        );

        setGovernanceNotice(
          "Waiting for Admin 1 to approve the proposal in MetaMask..."
        );

        const tx = await contract.proposeAdminAction(actionData);

        setGovernanceNotice(`Proposal submitted: ${tx.hash}`);

        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error("Proposal transaction was not successful.");
        }

        setProposalId(nextId.toString());

        setGovernanceNotice(
          `Northline proposal #${nextId.toString()} created successfully. Admin 1's confirmation is recorded. Admin 2 must confirm next.`
        );
      } catch (err) {
        setGovernanceError(errorText(err));
      } finally {
        setGovernanceBusy(false);
      }
    }

    // Admin 2: Confirm Northline approval proposal
    async function confirmNorthlineProposal() {
      setGovernanceBusy(true);
      setGovernanceError("");
      setGovernanceNotice("");

      try {
        if (!session || session.role !== "admin") {
          throw new Error("Sign in with an administrator wallet first.");
        }

        if (!isAdmin2) {
          throw new Error("Connect Admin 2's MetaMask wallet to confirm.");
        }

        if (!/^\d+$/.test(proposalId)) {
          throw new Error("Enter a valid proposal ID.");
        }

        const signer = await getSigner();
        const signerAddress = await signer.getAddress();

        if (signerAddress.toLowerCase() !== ADMIN_2.toLowerCase()) {
          throw new Error("The connected wallet is not Admin 2.");
        }

        const provider = signer.provider;

        if (!provider) {
          throw new Error("MetaMask provider is unavailable.");
        }

        const network = await provider.getNetwork();

        if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
          throw new Error("Please connect MetaMask to Sepolia.");
        }

        const contract = new Contract(
          CONTRACT_ADDRESS,
          abi as InterfaceAbi,
          signer
        );

        const nextId = await contract.nextProposalId();

        if (BigInt(proposalId) >= nextId) {
          throw new Error("This proposal ID does not exist.");
        }

        setGovernanceNotice(
          "Waiting for Admin 2's MetaMask confirmation..."
        );

        const tx = await contract.confirmAdminAction(BigInt(proposalId));

        setGovernanceNotice(`Confirmation submitted: ${tx.hash}`);

        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
          throw new Error("Confirmation transaction was not successful.");
        }

        const approved = await contract.approvedInstitutions(
          NORTHLINE_ADDRESS
        );

        if (approved) {
          setGovernanceNotice(
            "Success! Northline Institute is now approved on Sepolia."
          );
        } else {
          setGovernanceNotice(
            "Admin 2 confirmation was recorded. Northline is not yet approved. Check the proposal state."
          );
        }
      } catch (err) {
        setGovernanceError(errorText(err));
      } finally {
        setGovernanceBusy(false);
      }
    }

    // Load demonstration certificate
    async function loadDemoRecord() {
      setDemoLoading(true);
      setError("");
      setNotice("");

      try {
        const response = await fetch(
          "/demo/veridegree-demo-certificate.pdf"
        );

        if (!response.ok) {
          throw new Error(
            "The demonstration certificate could not be loaded. Refresh the page and try again."
          );
        }

        const blob = await response.blob();

        const demoFile = new File(
          [blob],
          "veridegree-demo-certificate.pdf",
          {
            type: "application/pdf",
            lastModified: Date.now(),
          }
        );

        const validationError = await validateCertificateFile(demoFile);

        if (validationError) {
          throw new Error(validationError);
        }

        setCertificate(demoFile);
        setDemoLoaded(true);

        const savedAddress =
          typeof window !== "undefined"
            ? window.localStorage.getItem(
                "veridegree:demo-student-address"
              ) || ""
            : "";

        const configuredAddress = DEMO_STUDENT_ADDRESS || savedAddress;

        if (configuredAddress) {
          setStudent(configuredAddress);
          setNotice(
            "Demo certificate and configured student wallet loaded. Review the recipient before issuing."
          );
        } else {
          setNotice(
            "Demo certificate loaded. Add your separate student test-wallet address below, then issue when ready."
          );
        }

        const input = document.getElementById(
          "credential-file"
        ) as HTMLInputElement | null;

        if (input) input.value = "";
      } catch (err) {
        setError(
          (err as Error).message ||
            "Could not load the demonstration certificate."
        );
      } finally {
        setDemoLoading(false);
      }
    }

    function updateStudentAddress(value: string) {
      setStudent(value);

      if (typeof window !== "undefined" && isAddress(value)) {
        window.localStorage.setItem(
          "veridegree:demo-student-address",
          value
        );
      }
    }

    function removeCertificate() {
      setCertificate(null);
      setDemoLoaded(false);

      const input = document.getElementById(
        "credential-file"
      ) as HTMLInputElement | null;

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

          const fileInput = document.getElementById(
            "credential-file"
          ) as HTMLInputElement | null;

          if (fileInput) fileInput.value = "";
        } else {
          setCertificate(nextFile);
          setDemoLoaded(false);
        }
      } catch {
        setError(
          "The selected file could not be read. Choose it again."
        );
      } finally {
        setCheckingFile(false);
      }
    }

    // Issue certificate
    async function issueCredential() {
      setError("");
      setNotice("");
      setTransaction("");

      if (!session || session.role !== "institution") {
        setError(
          "Issuance requires a currently approved institution wallet. Admin governance uses the separate 2-of-3 multisig flow."
        );
        return;
      }

      if (!certificate) {
        setError("Choose the exact certificate file to issue.");
        return;
      }

      if (!isAddress(student)) {
        setError("Enter a valid student wallet address.");
        return;
      }

      setBusy(true);

      try {
        const bytes = await certificate.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);

        const hash = `0x${Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")}`;

        const signer = await getSigner();

        const contract = new Contract(
          CONTRACT_ADDRESS,
          abi as InterfaceAbi,
          signer
        );

        setTransaction("Waiting for MetaMask approval...");

        const tx = await contract.issueCredential(hash, student);

        setTransaction(`Pending · ${tx.hash}`);

        const receipt = await tx.wait();

        const iface = new Interface(abi as InterfaceAbi);

        let issuedId: string | number = "confirmed";

        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);

            if (parsed?.name === "CredentialIssued") {
              issuedId = Number(parsed.args.credentialId);
            }
          } catch {
            // Ignore logs from other contracts.
          }
        }

        setNotice(
          `Credential ${
            issuedId === "confirmed"
              ? "issued"
              : `#${issuedId} issued`
          } successfully. The transaction is confirmed on Sepolia.`
        );

        setTransaction(`Confirmed · ${tx.hash}`);

        if (typeof issuedId === "number") {
          setCredentialId(String(issuedId));

          try {
            const record = await apiFetch<Credential>(
              `/api/institution/credentials/${issuedId}`,
              {},
              session.accessToken
            );

            setLookup(record);
          } catch {
            setLookup(null);
          }
        }

        setCertificate(null);
        setDemoLoaded(false);

        const fileInput = document.getElementById(
          "credential-file"
        ) as HTMLInputElement | null;

        if (fileInput) fileInput.value = "";
      } catch (err) {
        setError(errorText(err));
        setTransaction("");
      } finally {
        setBusy(false);
      }
    }

    // Find credential
    async function findCredential() {
      setError("");
      setNotice("");
      setLookup(null);

      if (!/^\d+$/.test(credentialId)) {
        setError("Enter a numeric credential ID.");
        return;
      }

      setBusy(true);

      try {
        const data = await apiFetch<Credential>(
          `/api/institution/credentials/${credentialId}`,
          {},
          session?.accessToken
        );

        setLookup(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    }

    // Revoke credential
    async function revokeCredential() {
      setError("");
      setNotice("");
      setTransaction("");

      if (!session) {
        setError("Sign in before revoking credentials.");
        return;
      }

      if (!lookup) {
        setError("Look up a credential first.");
        return;
      }

      if (
        lookup.issuer.toLowerCase() !== address?.toLowerCase() ||
        session.role !== "institution"
      ) {
        setError(
          "Only the currently approved original issuer can directly revoke this credential. Admin emergency revocation uses the 2-of-3 multisig."
        );
        return;
      }

      if (lookup.revoked) {
        setError("This credential is already revoked.");
        return;
      }

      setBusy(true);

      try {
        const signer = await getSigner();

        const contract = new Contract(
          CONTRACT_ADDRESS,
          abi as InterfaceAbi,
          signer
        );

        setTransaction("Waiting for MetaMask approval...");

        const tx = await contract.revokeCredential(
          lookup.credentialId
        );

        setTransaction(`Pending · ${tx.hash}`);

        await tx.wait();

        setNotice(
          `Credential #${lookup.credentialId} has been revoked on Sepolia.`
        );

        setTransaction(`Confirmed · ${tx.hash}`);

        await findCredential();
      } catch (err) {
        setError(errorText(err));
        setTransaction("");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="workspace-grid">
        <div className="workspace-main">
          <div className="workspace-intro">
            <span className="eyebrow">
              <span className="eyebrow-line" />
              INSTITUTION
            </span>

            <h1>
              Issue and manage
              <br />
              <em>credentials.</em>
            </h1>

            <p>
              Create certificate records for students and manage the
              records your institution has issued.
            </p>
          </div>

          <div className="session-card">
            <div className="session-led">
              <span
                className={`status-led ${session ? "active" : ""}`}
              />
            </div>

            <div className="session-info">
              <strong>
                {session ? "Wallet signed in" : "Sign in to continue"}
              </strong>

              <small>
                {session
                  ? `${shortAddress(session.address)} · ${session.role}`
                  : address
                    ? "Wallet connected. Sign in to continue."
                    : "Connect an approved institution wallet."}
              </small>
            </div>

            <button
              className="button button-outline button-small"
              onClick={() => void authenticate()}
              disabled={busy || walletBusy}
            >
              {busy || walletBusy
                ? "Please wait..."
                : session
                  ? "Refresh"
                  : "Sign in"}
            </button>
          </div>

          {(error || walletError) && (
            <div className="alert alert-error">
              {error || walletError}
            </div>
          )}

          {notice && (
            <div className="alert alert-success">{notice}</div>
          )}

          {transaction && (
            <div className="transaction-state">
              <span className="transaction-dot" />
              {transaction}
            </div>
          )}

          {/* ADMIN GOVERNANCE PANEL */}
          {session?.role === "admin" && (
            <div className="form-card">
              <div className="card-kicker">ADMIN GOVERNANCE</div>

              <h2>Institution approval</h2>

              <p>
                Approve Northline Institute through the
                2-of-3 administrator quorum.
              </p>

              <div className="record-detail">
                <span>Institution</span>
                <b>Northline Institute</b>
              </div>

              <div className="record-detail">
                <span>Institution wallet</span>
                <b>{shortAddress(NORTHLINE_ADDRESS)}</b>
              </div>

              <div className="record-detail">
                <span>Required confirmations</span>
                <b>2 of 3 administrators</b>
              </div>

              {isAdmin1 && (
                <button
                  className="button button-dark"
                  onClick={() => void createNorthlineProposal()}
                  disabled={governanceBusy}
                >
                  {governanceBusy
                    ? "Processing..."
                    : "Create Northline proposal"}
                </button>
              )}

              <label
                className="field-label"
                htmlFor="governance-proposal"
              >
                Proposal ID
              </label>

              <input
                id="governance-proposal"
                className="field-input"
                value={proposalId}
                onChange={(e) => setProposalId(e.target.value)}
                inputMode="numeric"
              />

              {isAdmin2 && (
                <button
                  className="button button-dark"
                  onClick={() => void confirmNorthlineProposal()}
                  disabled={governanceBusy}
                >
                  {governanceBusy
                    ? "Processing..."
                    : "Confirm as Admin 2"}
                </button>
              )}

              {governanceNotice && (
                <div className="alert alert-success">
                  {governanceNotice}
                </div>
              )}

              {governanceError && (
                <div className="alert alert-error">
                  {governanceError}
                </div>
              )}
            </div>
          )}

          {/* ISSUE CERTIFICATE */}
          <div className="form-card">
            <div className="card-kicker">NEW CREDENTIAL</div>

            <h2>Issue a certificate</h2>

            <p>
              Enter the student wallet and choose the original
              certificate file.
            </p>

            <div className="institution-demo-box">
              <div className="institution-demo-copy">
                <span>DEMO CERTIFICATE</span>
                <b>Northline Institute · Aarav Mehta</b>
                <small>Fictional sample · Applied Computing</small>
              </div>

              <button
                type="button"
                className="button-demo"
                onClick={() => void loadDemoRecord()}
                disabled={demoLoading || busy}
              >
                {demoLoading
                  ? "Loading..."
                  : demoLoaded
                    ? "Reload demo"
                    : "Load demo"}
              </button>
            </div>

            <label className="field-label" htmlFor="student-wallet">
              Student wallet
            </label>

            <input
              id="student-wallet"
              className="field-input"
              placeholder="0x... Student wallet address"
              value={student}
              onChange={(e) => updateStudentAddress(e.target.value)}
              spellCheck={false}
            />

            <small className="demo-address-help">
            Use the student&apos;s separate Sepolia test wallet.
            </small>

            <label className="field-label" htmlFor="credential-file">
              Certificate file
            </label>

            <input
              id="credential-file"
              className="field-input file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                void selectCertificate(e.target.files?.[0]);
              }}
            />

            {certificate && (
              <div className="selected-certificate">
                <span className="selected-certificate-mark">✓</span>

                <div>
                  <b>{certificate.name}</b>
                  <small>
                    {(certificate.size / 1024).toFixed(1)} KB ·{" "}
                    {demoLoaded
                      ? "DEMONSTRATION FILE"
                      : "READY TO HASH"}
                  </small>
                </div>

                <button
                  type="button"
                  onClick={removeCertificate}
                  aria-label="Remove selected certificate"
                >
                  ×
                </button>
              </div>
            )}

            <div className="form-footnote">
              SHA-256 fingerprint · PDF is not stored on-chain
            </div>

            <button
              className="button button-dark"
              onClick={() => void issueCredential()}
              disabled={
                busy ||
                checkingFile ||
                session?.role !== "institution" ||
                !student ||
                !certificate
              }
            >
              {checkingFile
                ? "Checking file..."
                : busy
                  ? "Processing..."
                  : "Issue certificate"}

              <span className="button-arrow">↗</span>
            </button>

            {!session && (
              <small className="muted-note">
                Sign in with an approved institution wallet to continue.
              </small>
            )}
          </div>

          {/* MANAGE CERTIFICATE */}
          <div className="form-card">
            <div className="card-kicker">MANAGE</div>

            <h2>Find a certificate</h2>

            <p>
              Enter its credential ID to view or revoke the record.
            </p>

            <label
              className="field-label"
              htmlFor="lookup-credential-id"
            >
              Credential ID
            </label>

            <div className="inline-field">
              <input
                id="lookup-credential-id"
                className="field-input"
                placeholder="Enter credential ID"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                inputMode="numeric"
              />

              <button
                className="button button-outline"
                onClick={() => void findCredential()}
                disabled={busy || !session}
              >
                Search
              </button>
            </div>

            {lookup && (
              <div className="record-preview">
                <div className="record-preview-top">
                  <strong>Credential #{lookup.credentialId}</strong>

                  <span className={`status-pill ${lookup.status}`}>
                    {lookup.status.replace("_", " ")}
                  </span>
                </div>

                <div className="record-detail">
                  <span>Student</span>
                  <b>{shortAddress(lookup.student)}</b>
                </div>

                <div className="record-detail">
                  <span>Issued</span>
                  <b>{formatDate(lookup.issuedAt)}</b>
                </div>

                <div className="record-detail">
                  <span>Issuer approved</span>
                  <b>{lookup.issuerApproved ? "Yes" : "No"}</b>
                </div>

                <button
                  className="button button-danger"
                  onClick={() => void revokeCredential()}
                  disabled={busy || lookup.revoked || !session}
                >
                  Revoke credential
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="workspace-aside">
          <div className="aside-note">
            <span className="eyebrow">
              <span className="eyebrow-line" />
              INSTITUTION ACCESS
            </span>

            <h3>
              Your wallet.
              <br />
              <em>Your control.</em>
            </h3>

            <p>
              Sign in with an approved wallet. Review each transaction
              in MetaMask before confirming.
            </p>

            <div className="aside-stat">
              <span>01</span>
              <b>Connect</b>
              <small>Connect MetaMask.</small>
            </div>

            <div className="aside-stat">
              <span>02</span>
              <b>Sign in</b>
              <small>We check institution approval.</small>
            </div>

            <div className="aside-stat">
              <span>03</span>
              <b>Confirm</b>
              <small>Review the transaction.</small>
            </div>
          </div>

          <LiveActivity compact />
        </aside>
      </div>
    );
  }
