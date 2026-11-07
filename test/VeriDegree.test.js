const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

function encode(veriDegree, functionName, args) {
  return veriDegree.interface.encodeFunctionData(functionName, args);
}

describe("VeriDegree", function () {
  let veriDegree;
  let adminA;
  let adminB;
  let adminC;
  let newAdmin;
  let institution;
  let otherInstitution;
  let student;
  let newWallet;
  let stranger;

  const certHash = ethers.sha256(ethers.toUtf8Bytes("certificate-001"));
  const secondHash = ethers.sha256(ethers.toUtf8Bytes("certificate-002"));

  beforeEach(async function () {
    [adminA, adminB, adminC, institution, otherInstitution, student, newWallet, stranger, newAdmin] =
      await ethers.getSigners();
    const VeriDegree = await ethers.getContractFactory("VeriDegree");
    veriDegree = await VeriDegree.deploy([adminA.address, adminB.address, adminC.address]);
  });

  async function proposalIdFrom(tx) {
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => {
        try { return veriDegree.interface.parseLog(log); } catch { return null; }
      })
      .find((parsed) => parsed && parsed.name === "ProposalCreated");
    return event.args.proposalId;
  }

  async function runAdminAction(functionName, args, proposer = adminA, confirmer = adminB) {
    const data = encode(veriDegree, functionName, args);
    const tx = await veriDegree.connect(proposer).proposeAdminAction(data);
    const proposalId = await proposalIdFrom(tx);
    await veriDegree.connect(confirmer).confirmAdminAction(proposalId);
    return proposalId;
  }

  async function approve(institutionAddress = institution.address) {
    await runAdminAction("addInstitution", [institutionAddress]);
  }

  async function issue(hash = certHash, studentAddress = student.address, issuer = institution) {
    return veriDegree.connect(issuer).issueCredential(hash, studentAddress);
  }

  async function signRecovery(credentialId, destinationWallet = newWallet, signer = destinationWallet) {
    const digest = await veriDegree.getRecoveryMessageHash(credentialId, destinationWallet.address);
    return signer.signMessage(ethers.getBytes(digest));
  }

  describe("deployment", function () {
    it("sets three distinct admins", async function () {
      expect(await veriDegree.admins(0)).to.equal(adminA.address);
      expect(await veriDegree.admins(1)).to.equal(adminB.address);
      expect(await veriDegree.admins(2)).to.equal(adminC.address);
      expect(await veriDegree.isAdmin(adminA.address)).to.equal(true);
      expect(await veriDegree.isAdmin(stranger.address)).to.equal(false);
    });

    it("starts with no credentials or proposals", async function () {
      expect(await veriDegree.nextCredentialId()).to.equal(0);
      expect(await veriDegree.nextProposalId()).to.equal(0);
    });

    it("rejects a zero admin address", async function () {
      const VeriDegree = await ethers.getContractFactory("VeriDegree");
      await expect(
        VeriDegree.deploy([adminA.address, ethers.ZeroAddress, adminC.address])
      ).to.be.revertedWithCustomError(veriDegree, "ZeroAddress");
    });

    it("rejects duplicate admin addresses", async function () {
      const VeriDegree = await ethers.getContractFactory("VeriDegree");
      await expect(
        VeriDegree.deploy([adminA.address, adminA.address, adminC.address])
      ).to.be.revertedWithCustomError(veriDegree, "DuplicateAdmin");
    });
  });

  describe("admin proposals", function () {
    it("requires two distinct admin confirmations", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      expect(await veriDegree.approvedInstitutions(institution.address)).to.equal(false);
      await veriDegree.connect(adminC).confirmAdminAction(0);
      expect(await veriDegree.approvedInstitutions(institution.address)).to.equal(true);
    });

    it("emits proposal lifecycle events", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      const proposal = await veriDegree.connect(adminA).proposeAdminAction(data);
      await expect(proposal)
        .to.emit(veriDegree, "ProposalCreated")
        .withArgs(0, adminA.address, data)
        .and.to.emit(veriDegree, "ProposalConfirmed")
        .withArgs(0, adminA.address, 1);
      await expect(veriDegree.connect(adminB).confirmAdminAction(0))
        .to.emit(veriDegree, "ProposalConfirmed")
        .withArgs(0, adminB.address, 2)
        .and.to.emit(veriDegree, "ProposalExecuted")
        .withArgs(0);
    });

    it("rejects non-admin proposal and confirmation attempts", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      await expect(veriDegree.connect(stranger).proposeAdminAction(data))
        .to.be.revertedWithCustomError(veriDegree, "NotAdmin");
      await veriDegree.connect(adminA).proposeAdminAction(data);
      await expect(veriDegree.connect(stranger).confirmAdminAction(0))
        .to.be.revertedWithCustomError(veriDegree, "NotAdmin");
    });

    it("rejects a second confirmation from the same admin", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      await expect(veriDegree.connect(adminA).confirmAdminAction(0))
        .to.be.revertedWithCustomError(veriDegree, "AlreadyConfirmed");
    });

    it("rejects confirming unknown or executed proposals", async function () {
      await expect(veriDegree.connect(adminA).confirmAdminAction(99))
        .to.be.revertedWithCustomError(veriDegree, "ProposalNotFound");
      await runAdminAction("addInstitution", [institution.address]);
      await expect(veriDegree.connect(adminC).confirmAdminAction(0))
        .to.be.revertedWithCustomError(veriDegree, "AlreadyExecuted");
    });

    it("rejects unsupported or malformed admin calldata before creating a proposal", async function () {
      const unsupported = encode(veriDegree, "updateCredentialStudent", [0, newWallet.address, "0x"]);
      await expect(veriDegree.connect(adminA).proposeAdminAction(unsupported))
        .to.be.revertedWithCustomError(veriDegree, "InvalidProposalData");
      await expect(veriDegree.connect(adminA).proposeAdminAction("0x1234"))
        .to.be.revertedWithCustomError(veriDegree, "InvalidProposalData");
    });

    it("allows a proposer to cancel their own pending proposal", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      await expect(veriDegree.connect(adminA).cancelAdminAction(0))
        .to.emit(veriDegree, "ProposalCancelledEvent")
        .withArgs(0, adminA.address);
      await expect(veriDegree.connect(adminB).confirmAdminAction(0))
        .to.be.revertedWithCustomError(veriDegree, "ProposalCancelled");
      expect(await veriDegree.approvedInstitutions(institution.address)).to.equal(false);
    });

    it("does not let a different admin cancel the proposer's proposal", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      await expect(veriDegree.connect(adminB).cancelAdminAction(0))
        .to.be.revertedWithCustomError(veriDegree, "ProposalNotCancellable");
    });

    it("expires proposals after seven days", async function () {
      const data = encode(veriDegree, "addInstitution", [institution.address]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      await time.increase(7 * 24 * 60 * 60 + 1);
      await expect(veriDegree.connect(adminB).confirmAdminAction(0))
        .to.be.revertedWithCustomError(veriDegree, "ProposalExpired");
    });

    it("preserves the actual custom error when a proposal becomes invalid before execution", async function () {
      await approve();
      await issue();
      const data = encode(veriDegree, "revokeCredential", [0]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      await veriDegree.connect(institution).revokeCredential(0);
      await expect(veriDegree.connect(adminB).confirmAdminAction(1))
        .to.be.revertedWithCustomError(veriDegree, "AlreadyRevoked");
    });

    it("allows the remaining two admins to act when one admin key is unavailable", async function () {
      await runAdminAction("addInstitution", [institution.address], adminB, adminC);
      expect(await veriDegree.approvedInstitutions(institution.address)).to.equal(true);
    });
  });

  describe("admin management", function () {
    it("adds, removes and names institutions through multisig", async function () {
      await approve();
      expect(await veriDegree.approvedInstitutions(institution.address)).to.equal(true);
      await runAdminAction("setInstitutionName", [institution.address, "Atria University"]);
      expect(await veriDegree.institutionNames(institution.address)).to.equal("Atria University");
      await runAdminAction("removeInstitution", [institution.address]);
      expect(await veriDegree.approvedInstitutions(institution.address)).to.equal(false);
    });

    it("rejects invalid institution admin actions at proposal time", async function () {
      const data = encode(veriDegree, "addInstitution", [ethers.ZeroAddress]);
      await expect(veriDegree.connect(adminA).proposeAdminAction(data))
        .to.be.revertedWithCustomError(veriDegree, "ZeroAddress");
    });

    it("replaces an admin only after two approvals", async function () {
      const data = encode(veriDegree, "replaceAdmin", [adminA.address, newAdmin.address]);
      await veriDegree.connect(adminA).proposeAdminAction(data);
      expect(await veriDegree.isAdmin(adminA.address)).to.equal(true);
      await expect(veriDegree.connect(adminB).confirmAdminAction(0))
        .to.emit(veriDegree, "AdminReplaced")
        .withArgs(adminA.address, newAdmin.address);
      expect(await veriDegree.isAdmin(adminA.address)).to.equal(false);
      expect(await veriDegree.isAdmin(newAdmin.address)).to.equal(true);
      expect(await veriDegree.admins(0)).to.equal(newAdmin.address);
    });

    it("rejects admin replacement with a non-admin or already-admin address", async function () {
      await expect(veriDegree.connect(adminA).proposeAdminAction(
        encode(veriDegree, "replaceAdmin", [stranger.address, newAdmin.address])
      )).to.be.revertedWithCustomError(veriDegree, "InvalidAdminReplacement");
      await expect(veriDegree.connect(adminA).proposeAdminAction(
        encode(veriDegree, "replaceAdmin", [adminA.address, adminB.address])
      )).to.be.revertedWithCustomError(veriDegree, "InvalidAdminReplacement");
    });
  });

  describe("credential issuance and hash lookup", function () {
    beforeEach(approve);

    it("issues a credential and records the student and issuer", async function () {
      const tx = await issue();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx)
        .to.emit(veriDegree, "CredentialIssued")
        .withArgs(0, institution.address, student.address, certHash, block.timestamp);
      const [hash, issuer, recipient, , isValid] = await veriDegree.verifyCredential(0);
      expect(hash).to.equal(certHash);
      expect(issuer).to.equal(institution.address);
      expect(recipient).to.equal(student.address);
      expect(isValid).to.equal(true);
      expect(await veriDegree.nextCredentialId()).to.equal(1);
    });

    it("rejects issuance from an unapproved institution", async function () {
      await expect(veriDegree.connect(stranger).issueCredential(certHash, student.address))
        .to.be.revertedWithCustomError(veriDegree, "NotApprovedInstitution");
    });

    it("rejects zero student addresses and empty hashes", async function () {
      await expect(veriDegree.connect(institution).issueCredential(certHash, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(veriDegree, "ZeroAddress");
      await expect(veriDegree.connect(institution).issueCredential(ethers.ZeroHash, student.address))
        .to.be.revertedWithCustomError(veriDegree, "EmptyHash");
    });

    it("rejects a duplicate certificate hash globally", async function () {
      await issue();
      await expect(issue(certHash, newWallet.address))
        .to.be.revertedWithCustomError(veriDegree, "DuplicateCertificateHash");
      await runAdminAction("addInstitution", [otherInstitution.address]);
      await expect(issue(certHash, newWallet.address, otherInstitution))
        .to.be.revertedWithCustomError(veriDegree, "DuplicateCertificateHash");
    });

    it("maps a unique hash to its credential ID and verifies directly by hash", async function () {
      await issue();
      expect(await veriDegree.getCredentialIdByHash(certHash)).to.equal(0);
      const [id, issuer, recipient, , isValid] = await veriDegree.verifyCredentialByHash(certHash);
      expect(id).to.equal(0);
      expect(issuer).to.equal(institution.address);
      expect(recipient).to.equal(student.address);
      expect(isValid).to.equal(true);
    });

    it("returns a clear error for unknown or empty hashes", async function () {
      await expect(veriDegree.getCredentialIdByHash(secondHash))
        .to.be.revertedWithCustomError(veriDegree, "CertificateHashNotFound");
      await expect(veriDegree.getCredentialIdByHash(ethers.ZeroHash))
        .to.be.revertedWithCustomError(veriDegree, "EmptyHash");
    });

    it("stores each issued ID under the correct student", async function () {
      await issue();
      await issue(secondHash, newWallet.address);
      expect((await veriDegree.getStudentCredentials(student.address)).map(Number)).to.deep.equal([0]);
      expect((await veriDegree.getStudentCredentials(newWallet.address)).map(Number)).to.deep.equal([1]);
    });

    it("keeps existing credentials after institution removal but blocks new issuance", async function () {
      await issue();
      await runAdminAction("removeInstitution", [institution.address]);
      const [hash, issuer, recipient, , isValid] = await veriDegree.verifyCredential(0);
      expect(hash).to.equal(certHash);
      expect(issuer).to.equal(institution.address);
      expect(recipient).to.equal(student.address);
      expect(isValid).to.equal(true);
      await expect(issue(secondHash)).to.be.revertedWithCustomError(veriDegree, "NotApprovedInstitution");
    });
  });

  describe("revocation", function () {
    beforeEach(async function () {
      await approve();
      await issue();
    });

    it("lets a currently approved issuing institution revoke its own credential", async function () {
      await expect(veriDegree.connect(institution).revokeCredential(0))
        .to.emit(veriDegree, "CredentialRevoked");
      const [, , , , isValid] = await veriDegree.verifyCredential(0);
      expect(isValid).to.equal(false);
    });

    it("blocks a removed institution from revoking its old credentials", async function () {
      await runAdminAction("removeInstitution", [institution.address]);
      await expect(veriDegree.connect(institution).revokeCredential(0))
        .to.be.revertedWithCustomError(veriDegree, "NotIssuerOrAdmin");
    });

    it("keeps the 2-of-3 emergency revocation path after issuer removal", async function () {
      await runAdminAction("removeInstitution", [institution.address]);
      await runAdminAction("revokeCredential", [0]);
      const [, , , , isValid] = await veriDegree.verifyCredential(0);
      expect(isValid).to.equal(false);
    });

    it("blocks admins acting alone and unrelated accounts", async function () {
      await expect(veriDegree.connect(adminA).revokeCredential(0))
        .to.be.revertedWithCustomError(veriDegree, "NotIssuerOrAdmin");
      await expect(veriDegree.connect(stranger).revokeCredential(0))
        .to.be.revertedWithCustomError(veriDegree, "NotIssuerOrAdmin");
    });

    it("rejects unknown and already-revoked credentials", async function () {
      await expect(veriDegree.connect(institution).revokeCredential(99))
        .to.be.revertedWithCustomError(veriDegree, "InvalidCredential");
      await veriDegree.connect(institution).revokeCredential(0);
      await expect(veriDegree.connect(institution).revokeCredential(0))
        .to.be.revertedWithCustomError(veriDegree, "AlreadyRevoked");
    });

    it("allows only the original issuer to revoke directly", async function () {
      await approve(otherInstitution.address);
      await expect(veriDegree.connect(otherInstitution).revokeCredential(0))
        .to.be.revertedWithCustomError(veriDegree, "NotIssuerOrAdmin");
    });

    it("supports bounded emergency batch revocation through multisig", async function () {
      await issue(secondHash, newWallet.address);
      const data = encode(veriDegree, "revokeCredentials", [[0, 1]]);
      const tx = await veriDegree.connect(adminA).proposeAdminAction(data);
      const proposalId = await proposalIdFrom(tx);
      await veriDegree.connect(adminB).confirmAdminAction(proposalId);
      expect((await veriDegree.verifyCredential(0))[4]).to.equal(false);
      expect((await veriDegree.verifyCredential(1))[4]).to.equal(false);
    });

    it("rejects empty, oversized, duplicate or invalid batch proposals", async function () {
      await expect(veriDegree.connect(adminA).proposeAdminAction(
        encode(veriDegree, "revokeCredentials", [[]])
      )).to.be.revertedWithCustomError(veriDegree, "BatchTooLarge");
      await expect(veriDegree.connect(adminA).proposeAdminAction(
        encode(veriDegree, "revokeCredentials", [[0, 0]])
      )).to.be.revertedWithCustomError(veriDegree, "InvalidProposalData");
      await expect(veriDegree.connect(adminA).proposeAdminAction(
        encode(veriDegree, "revokeCredentials", [[99]])
      )).to.be.revertedWithCustomError(veriDegree, "InvalidCredential");
    });
  });

  describe("student wallet recovery", function () {
    beforeEach(async function () {
      await approve();
      await issue();
    });

    it("requires the destination wallet's signature and updates the credential", async function () {
      const signature = await signRecovery(0);
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, signature))
        .to.emit(veriDegree, "CredentialStudentUpdated");
      expect((await veriDegree.verifyCredential(0))[2]).to.equal(newWallet.address);
      expect((await veriDegree.getStudentCredentials(student.address)).length).to.equal(0);
      expect((await veriDegree.getStudentCredentials(newWallet.address)).map(Number)).to.deep.equal([0]);
      expect(await veriDegree.recoveryNonces(0)).to.equal(1);
    });

    it("rejects a signature from any wallet other than the destination wallet", async function () {
      const signature = await signRecovery(0, newWallet, stranger);
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, signature))
        .to.be.revertedWithCustomError(veriDegree, "InvalidSignature");
    });

    it("rejects recovery by a non-issuer or unapproved issuer", async function () {
      const signature = await signRecovery(0);
      await expect(veriDegree.connect(stranger).updateCredentialStudent(0, newWallet.address, signature))
        .to.be.revertedWithCustomError(veriDegree, "NotApprovedInstitution");
      await approve(otherInstitution.address);
      await expect(veriDegree.connect(otherInstitution).updateCredentialStudent(0, newWallet.address, signature))
        .to.be.revertedWithCustomError(veriDegree, "NotIssuer");
    });

    it("blocks a removed institution from recovering credentials", async function () {
      await runAdminAction("removeInstitution", [institution.address]);
      const signature = await signRecovery(0);
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, signature))
        .to.be.revertedWithCustomError(veriDegree, "NotApprovedInstitution");
    });

    it("rejects zero, unchanged and revoked destination updates", async function () {
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, ethers.ZeroAddress, "0x"))
        .to.be.revertedWithCustomError(veriDegree, "ZeroAddress");
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, student.address, "0x"))
        .to.be.revertedWithCustomError(veriDegree, "StudentUnchanged");
      await veriDegree.connect(institution).revokeCredential(0);
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, "0x"))
        .to.be.revertedWithCustomError(veriDegree, "AlreadyRevoked");
    });

    it("rejects replaying an old recovery signature", async function () {
      const signature = await signRecovery(0);
      await veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, signature);
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, signature))
        .to.be.revertedWithCustomError(veriDegree, "StudentUnchanged");
      await expect(veriDegree.connect(institution).updateCredentialStudent(0, student.address, signature))
        .to.be.revertedWithCustomError(veriDegree, "InvalidSignature");
      const backToOldWalletSignature = await signRecovery(0, student, student);
      await veriDegree.connect(institution).updateCredentialStudent(0, student.address, backToOldWalletSignature);
      expect((await veriDegree.verifyCredential(0))[2]).to.equal(student.address);
    });

    it("cannot be executed through a multisig proposal", async function () {
      const data = encode(veriDegree, "updateCredentialStudent", [0, newWallet.address, "0x"]);
      await expect(veriDegree.connect(adminA).proposeAdminAction(data))
        .to.be.revertedWithCustomError(veriDegree, "InvalidProposalData");
    });

    it("maintains student indexes after swap-and-pop recovery", async function () {
      await issue(secondHash, student.address);
      const signature = await signRecovery(0);
      await veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, signature);
      expect((await veriDegree.getStudentCredentials(student.address)).map(Number)).to.deep.equal([1]);
      expect((await veriDegree.getStudentCredentials(newWallet.address)).map(Number)).to.deep.equal([0]);
    });

    it("keeps moved credential indexes correct across repeated removals", async function () {
      const thirdHash = ethers.sha256(ethers.toUtf8Bytes("certificate-003"));
      await issue(secondHash, student.address);
      await issue(thirdHash, student.address);

      const firstRecovery = await signRecovery(0, newWallet, newWallet);
      await veriDegree.connect(institution).updateCredentialStudent(0, newWallet.address, firstRecovery);
      // Removing ID 0 swaps the last ID (2) into its array slot.
      expect((await veriDegree.getStudentCredentials(student.address)).map(Number).sort()).to.deep.equal([1, 2]);

      const secondRecovery = await signRecovery(2, stranger, stranger);
      await veriDegree.connect(institution).updateCredentialStudent(2, stranger.address, secondRecovery);
      expect((await veriDegree.getStudentCredentials(student.address)).map(Number)).to.deep.equal([1]);
      expect((await veriDegree.getStudentCredentials(stranger.address)).map(Number)).to.deep.equal([2]);
    });
  });

  describe("student pagination", function () {
    beforeEach(async function () {
      await approve();
      await issue();
      await issue(secondHash, newWallet.address);
    });

    it("returns a selected page", async function () {
      const page = await veriDegree.getStudentCredentialsPage(student.address, 0, 10);
      expect(page.map(Number)).to.deep.equal([0]);
      const empty = await veriDegree.getStudentCredentialsPage(student.address, 1, 10);
      expect(empty.length).to.equal(0);
    });

    it("rejects zero or oversized page limits", async function () {
      await expect(veriDegree.getStudentCredentialsPage(student.address, 0, 0))
        .to.be.revertedWithCustomError(veriDegree, "InvalidPageSize");
      await expect(veriDegree.getStudentCredentialsPage(student.address, 0, 101))
        .to.be.revertedWithCustomError(veriDegree, "InvalidPageSize");
    });
  });

  describe("privacy and validity semantics", function () {
    it("keeps personal data off-chain and returns revocation status only", async function () {
      await approve();
      await issue();
      const [hash, issuer, recipient, issuedAt, isValid] = await veriDegree.verifyCredential(0);
      expect(hash).to.equal(certHash);
      expect(issuer).to.equal(institution.address);
      expect(recipient).to.equal(student.address);
      expect(issuedAt).to.be.a("bigint");
      expect(isValid).to.equal(true);
      expect(await veriDegree.approvedInstitutions(issuer)).to.equal(true);
    });

    it("does not silently change isValid when an issuer is removed", async function () {
      await approve();
      await issue();
      await runAdminAction("removeInstitution", [institution.address]);
      const [, issuer, , , isValid] = await veriDegree.verifyCredential(0);
      expect(isValid).to.equal(true); // means not revoked; frontend must also check approvedInstitutions.
      expect(await veriDegree.approvedInstitutions(issuer)).to.equal(false);
    });

    it("allows anyone to verify by ID or by hash", async function () {
      await approve();
      await issue();
      expect((await veriDegree.connect(stranger).verifyCredential(0))[4]).to.equal(true);
      expect((await veriDegree.connect(stranger).verifyCredentialByHash(certHash))[0]).to.equal(0);
    });
  });

  describe("ether handling", function () {
    it("rejects ordinary Ether transfers", async function () {
      await expect(adminA.sendTransaction({ to: await veriDegree.getAddress(), value: 1 })).to.be.reverted;
    });
  });
});
