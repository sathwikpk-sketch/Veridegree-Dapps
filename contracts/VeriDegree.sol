// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VeriDegree — on-chain academic credential registry
/// @notice Stores certificate hashes and minimal public verification metadata.
///         Certificate files and personal details must remain off-chain.
contract VeriDegree {
    uint256 public constant ADMIN_QUORUM = 2;
    uint256 public constant PROPOSAL_EXPIRY = 7 days;
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public constant MAX_PAGE_SIZE = 100;

    // secp256k1n / 2, used to reject malleable ECDSA signatures.
    uint256 private constant SECP256K1_HALF_N =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    bytes32 private constant RECOVERY_TYPEHASH = keccak256(
        "VeriDegreeCredentialRecovery(uint256 chainId,address verifyingContract,uint256 credentialId,address oldStudent,address newStudent,uint256 nonce)"
    );
    bytes4 private constant ADD_INSTITUTION_SELECTOR = bytes4(keccak256("addInstitution(address)"));
    bytes4 private constant REMOVE_INSTITUTION_SELECTOR = bytes4(keccak256("removeInstitution(address)"));
    bytes4 private constant SET_INSTITUTION_NAME_SELECTOR = bytes4(keccak256("setInstitutionName(address,string)"));
    bytes4 private constant REVOKE_CREDENTIAL_SELECTOR = bytes4(keccak256("revokeCredential(uint256)"));
    bytes4 private constant REVOKE_CREDENTIALS_SELECTOR = bytes4(keccak256("revokeCredentials(uint256[])"));
    bytes4 private constant REPLACE_ADMIN_SELECTOR = bytes4(keccak256("replaceAdmin(address,address)"));

    struct Credential {
        bytes32 certHash;
        address institution;
        address student;
        uint256 issuedAt;
        bool revoked;
    }

    struct Proposal {
        bytes data;
        address proposer;
        uint64 createdAt;
        uint256 confirmations;
        bool executed;
        bool cancelled;
    }

    address[3] public admins;
    mapping(address => bool) public isAdmin;
    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasConfirmed;

    mapping(address => bool) public approvedInstitutions;
    mapping(address => string) public institutionNames;

    uint256 public nextCredentialId;
    mapping(uint256 => Credential) public credentials;
    mapping(address => uint256[]) public studentCredentials;

    /// @notice Stores credential ID + 1 so zero means that a hash is unregistered.
    mapping(bytes32 => uint256) public credentialIdPlusOneByHash;

    /// @dev One-based position of each credential ID in a student's array.
    ///      It enables O(1) swap-and-pop removal during wallet recovery.
    mapping(address => mapping(uint256 => uint256)) private studentCredentialPositionPlusOne;

    /// @notice Increments after each successful recovery to prevent signature replay.
    mapping(uint256 => uint256) public recoveryNonces;

    error NotAdmin();
    error NotSelf();
    error DuplicateAdmin();
    error InvalidAdminReplacement();
    error ProposalNotFound();
    error AlreadyExecuted();
    error AlreadyConfirmed();
    error ProposalExecutionFailed();
    error ProposalExpired();
    error ProposalCancelled();
    error ProposalNotCancellable();
    error InvalidProposalData();
    error NotApprovedInstitution();
    error NotIssuerOrAdmin();
    error NotIssuer();
    error ZeroAddress();
    error EmptyHash();
    error DuplicateCertificateHash();
    error CertificateHashNotFound();
    error InvalidCredential();
    error AlreadyRevoked();
    error InvalidSignature();
    error StudentUnchanged();
    error BatchTooLarge();
    error InvalidPageSize();

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, bytes data);
    event ProposalConfirmed(uint256 indexed proposalId, address indexed admin, uint256 confirmations);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelledEvent(uint256 indexed proposalId, address indexed cancelledBy);

    event AdminReplaced(address indexed oldAdmin, address indexed newAdmin);
    event InstitutionAdded(address indexed institution);
    event InstitutionRemoved(address indexed institution);
    event InstitutionNameSet(address indexed institution, string name);
    event CredentialIssued(
        uint256 indexed credentialId,
        address indexed institution,
        address indexed student,
        bytes32 certHash,
        uint256 issuedAt
    );
    event CredentialRevoked(uint256 indexed credentialId, address indexed revokedBy, uint256 revokedAt);
    event CredentialStudentUpdated(
        uint256 indexed credentialId,
        address indexed oldStudent,
        address indexed newStudent,
        uint256 updatedAt
    );

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender]) revert NotAdmin();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();
        _;
    }

    modifier onlyApprovedInstitution() {
        if (!approvedInstitutions[msg.sender]) revert NotApprovedInstitution();
        _;
    }

    /// @param _admins Exactly three distinct, non-zero administrator addresses.
    constructor(address[3] memory _admins) {
        for (uint256 i = 0; i < 3; i++) {
            if (_admins[i] == address(0)) revert ZeroAddress();
            for (uint256 j = i + 1; j < 3; j++) {
                if (_admins[i] == _admins[j]) revert DuplicateAdmin();
            }
        }
        admins = _admins;
        isAdmin[_admins[0]] = true;
        isAdmin[_admins[1]] = true;
        isAdmin[_admins[2]] = true;
    }

    // ---------------------------------------------------------------------
    // 2-of-3 administrative proposals
    // ---------------------------------------------------------------------

    function proposeAdminAction(bytes calldata data) external onlyAdmin returns (uint256 proposalId) {
        _validateAdminAction(data);

        proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({
            data: data,
            proposer: msg.sender,
            createdAt: uint64(block.timestamp),
            confirmations: 0,
            executed: false,
            cancelled: false
        });
        emit ProposalCreated(proposalId, msg.sender, data);
        _confirm(proposalId);
    }

    function confirmAdminAction(uint256 proposalId) external onlyAdmin {
        if (proposalId >= nextProposalId) revert ProposalNotFound();
        _confirm(proposalId);
    }

    /// @notice Lets the proposer withdraw an unexecuted proposal.
    function cancelAdminAction(uint256 proposalId) external onlyAdmin {
        if (proposalId >= nextProposalId) revert ProposalNotFound();
        Proposal storage proposal = proposals[proposalId];
        if (proposal.executed || proposal.cancelled || proposal.proposer != msg.sender) {
            revert ProposalNotCancellable();
        }
        proposal.cancelled = true;
        emit ProposalCancelledEvent(proposalId, msg.sender);
    }

    function _confirm(uint256 proposalId) private {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.executed) revert AlreadyExecuted();
        if (proposal.cancelled) revert ProposalCancelled();
        if (block.timestamp > uint256(proposal.createdAt) + PROPOSAL_EXPIRY) revert ProposalExpired();
        if (hasConfirmed[proposalId][msg.sender]) revert AlreadyConfirmed();

        hasConfirmed[proposalId][msg.sender] = true;
        proposal.confirmations++;
        emit ProposalConfirmed(proposalId, msg.sender, proposal.confirmations);

        if (proposal.confirmations >= ADMIN_QUORUM) {
            proposal.executed = true;
            (bool success, bytes memory returnData) = address(this).call(proposal.data);
            if (!success) {
                // Preserve the target function's real custom error for wallets and UIs.
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
            emit ProposalExecuted(proposalId);
        }
    }

    /// @dev Only approved administrative selectors may be proposed. Decode
    ///      and validate their arguments before a proposal enters the queue.
    function _validateAdminAction(bytes calldata data) private view {
        if (data.length < 4) revert InvalidProposalData();
        bytes4 selector;
        assembly {
            selector := calldataload(data.offset)
        }

        if (selector == ADD_INSTITUTION_SELECTOR || selector == REMOVE_INSTITUTION_SELECTOR) {
            if (data.length != 36) revert InvalidProposalData();
            address institution = abi.decode(data[4:], (address));
            if (institution == address(0)) revert ZeroAddress();
            if (selector == REMOVE_INSTITUTION_SELECTOR && !approvedInstitutions[institution]) {
                // Removing an already-removed address is almost certainly a stale proposal.
                revert InvalidProposalData();
            }
            return;
        }

        if (selector == SET_INSTITUTION_NAME_SELECTOR) {
            if (data.length < 68) revert InvalidProposalData();
            (address institution, ) = abi.decode(data[4:], (address, string));
            if (institution == address(0)) revert ZeroAddress();
            return;
        }

        if (selector == REVOKE_CREDENTIAL_SELECTOR) {
            if (data.length != 36) revert InvalidProposalData();
            uint256 credentialId = abi.decode(data[4:], (uint256));
            if (credentialId >= nextCredentialId) revert InvalidCredential();
            if (credentials[credentialId].revoked) revert AlreadyRevoked();
            return;
        }

        if (selector == REVOKE_CREDENTIALS_SELECTOR) {
            if (data.length < 68) revert InvalidProposalData();
            uint256[] memory credentialIds = abi.decode(data[4:], (uint256[]));
            uint256 length = credentialIds.length;
            if (length == 0 || length > MAX_BATCH_SIZE) revert BatchTooLarge();
            for (uint256 i = 0; i < length; i++) {
                uint256 id = credentialIds[i];
                if (id >= nextCredentialId) revert InvalidCredential();
                if (credentials[id].revoked) revert AlreadyRevoked();
                for (uint256 j = 0; j < i; j++) {
                    if (credentialIds[j] == id) revert InvalidProposalData();
                }
            }
            return;
        }

        if (selector == REPLACE_ADMIN_SELECTOR) {
            if (data.length != 68) revert InvalidProposalData();
            (address oldAdmin, address newAdmin) = abi.decode(data[4:], (address, address));
            if (oldAdmin == address(0) || newAdmin == address(0)) revert ZeroAddress();
            if (!isAdmin[oldAdmin] || isAdmin[newAdmin] || oldAdmin == newAdmin) {
                revert InvalidAdminReplacement();
            }
            return;
        }

        revert InvalidProposalData();
    }

    // ---------------------------------------------------------------------
    // Administrative actions — only reachable by the contract self-call
    // after two distinct admins confirm.
    // ---------------------------------------------------------------------

    function addInstitution(address institution) external onlySelf {
        if (institution == address(0)) revert ZeroAddress();
        approvedInstitutions[institution] = true;
        emit InstitutionAdded(institution);
    }

    /// @notice Removes an institution's live permissions. Existing credentials
    ///         remain in storage; the institution can no longer issue, revoke,
    ///         or recover any credential until it is re-approved.
    function removeInstitution(address institution) external onlySelf {
        approvedInstitutions[institution] = false;
        emit InstitutionRemoved(institution);
    }

    function setInstitutionName(address institution, string calldata name) external onlySelf {
        if (institution == address(0)) revert ZeroAddress();
        institutionNames[institution] = name;
        emit InstitutionNameSet(institution, name);
    }

    /// @notice Replaces one admin through the same 2-of-3 proposal process.
    ///         At least two currently-authorized admins must approve the change.
    function replaceAdmin(address oldAdmin, address newAdmin) external onlySelf {
        if (oldAdmin == address(0) || newAdmin == address(0)) revert ZeroAddress();
        if (!isAdmin[oldAdmin] || isAdmin[newAdmin] || oldAdmin == newAdmin) {
            revert InvalidAdminReplacement();
        }

        for (uint256 i = 0; i < 3; i++) {
            if (admins[i] == oldAdmin) {
                admins[i] = newAdmin;
                break;
            }
        }
        isAdmin[oldAdmin] = false;
        isAdmin[newAdmin] = true;
        emit AdminReplaced(oldAdmin, newAdmin);
    }

    // ---------------------------------------------------------------------
    // Credential issuance, revocation and wallet recovery
    // ---------------------------------------------------------------------

    function issueCredential(bytes32 certHash, address student)
        external
        onlyApprovedInstitution
        returns (uint256)
    {
        if (student == address(0)) revert ZeroAddress();
        if (certHash == bytes32(0)) revert EmptyHash();
        if (credentialIdPlusOneByHash[certHash] != 0) revert DuplicateCertificateHash();

        uint256 credentialId = nextCredentialId++;
        credentials[credentialId] = Credential({
            certHash: certHash,
            institution: msg.sender,
            student: student,
            issuedAt: block.timestamp,
            revoked: false
        });
        credentialIdPlusOneByHash[certHash] = credentialId + 1;
        _addCredentialToStudent(student, credentialId);

        emit CredentialIssued(credentialId, msg.sender, student, certHash, block.timestamp);
        return credentialId;
    }

    /// @notice Direct revocation is available only to a currently-approved
    ///         original issuer. The 2-of-3 multisig can always revoke globally.
    function revokeCredential(uint256 credentialId) external {
        if (credentialId >= nextCredentialId) revert InvalidCredential();
        Credential storage credential = credentials[credentialId];

        if (msg.sender != address(this)) {
            if (msg.sender != credential.institution || !approvedInstitutions[msg.sender]) {
                revert NotIssuerOrAdmin();
            }
        }
        _revokeCredential(credentialId, credential);
    }

    /// @notice Emergency batch revocation. Must be encoded as a 2-of-3 admin
    ///         proposal. The whole batch is atomic and capped at 50 records.
    function revokeCredentials(uint256[] calldata credentialIds) external onlySelf {
        uint256 length = credentialIds.length;
        if (length == 0 || length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < length; i++) {
            uint256 credentialId = credentialIds[i];
            if (credentialId >= nextCredentialId) revert InvalidCredential();
            _revokeCredential(credentialId, credentials[credentialId]);
        }
    }

    function _revokeCredential(uint256 credentialId, Credential storage credential) private {
        if (credential.revoked) revert AlreadyRevoked();
        credential.revoked = true;
        // For an emergency multisig action msg.sender is address(this). The
        // backend must display that as "Admin multisig", not as an institution.
        emit CredentialRevoked(credentialId, msg.sender, block.timestamp);
    }

    /// @notice Returns the digest that the destination wallet must sign using
    ///         personal_sign / ethers.signMessage. The digest binds the chain,
    ///         contract, credential, old wallet, new wallet and nonce.
    function getRecoveryMessageHash(uint256 credentialId, address newStudent)
        external
        view
        returns (bytes32)
    {
        if (credentialId >= nextCredentialId) revert InvalidCredential();
        if (newStudent == address(0)) revert ZeroAddress();
        Credential storage credential = credentials[credentialId];
        if (newStudent == credential.student) revert StudentUnchanged();
        return _recoveryMessageHash(credentialId, credential.student, newStudent, recoveryNonces[credentialId]);
    }

    /// @notice The original issuer must still be approved and the new wallet
    ///         must sign the contract-generated recovery challenge.
    function updateCredentialStudent(
        uint256 credentialId,
        address newStudent,
        bytes calldata newStudentSignature
    ) external onlyApprovedInstitution {
        if (credentialId >= nextCredentialId) revert InvalidCredential();
        Credential storage credential = credentials[credentialId];
        if (msg.sender != credential.institution) revert NotIssuer();
        if (newStudent == address(0)) revert ZeroAddress();
        if (newStudent == credential.student) revert StudentUnchanged();
        if (credential.revoked) revert AlreadyRevoked();

        bytes32 messageHash = _recoveryMessageHash(
            credentialId,
            credential.student,
            newStudent,
            recoveryNonces[credentialId]
        );
        if (_recoverSigner(messageHash, newStudentSignature) != newStudent) revert InvalidSignature();

        address oldStudent = credential.student;
        _removeCredentialFromStudent(oldStudent, credentialId);
        credential.student = newStudent;
        recoveryNonces[credentialId]++;
        _addCredentialToStudent(newStudent, credentialId);

        emit CredentialStudentUpdated(credentialId, oldStudent, newStudent, block.timestamp);
    }

    function _recoveryMessageHash(
        uint256 credentialId,
        address oldStudent,
        address newStudent,
        uint256 nonce
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                RECOVERY_TYPEHASH,
                block.chainid,
                address(this),
                credentialId,
                oldStudent,
                newStudent,
                nonce
            )
        );
    }

    function _recoverSigner(bytes32 messageHash, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        if (uint256(s) > SECP256K1_HALF_N) revert InvalidSignature();

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        address signer = ecrecover(ethSignedMessageHash, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    // ---------------------------------------------------------------------
    // Student credential indexing
    // ---------------------------------------------------------------------

    function _addCredentialToStudent(address student, uint256 credentialId) private {
        uint256[] storage ids = studentCredentials[student];
        ids.push(credentialId);
        studentCredentialPositionPlusOne[student][credentialId] = ids.length;
    }

    function _removeCredentialFromStudent(address student, uint256 credentialId) private {
        uint256[] storage ids = studentCredentials[student];
        uint256 positionPlusOne = studentCredentialPositionPlusOne[student][credentialId];
        if (positionPlusOne == 0) revert InvalidCredential();

        uint256 index = positionPlusOne - 1;
        uint256 lastIndex = ids.length - 1;
        if (index != lastIndex) {
            uint256 movedCredentialId = ids[lastIndex];
            ids[index] = movedCredentialId;
            studentCredentialPositionPlusOne[student][movedCredentialId] = index + 1;
        }
        ids.pop();
        delete studentCredentialPositionPlusOne[student][credentialId];
    }

    function getStudentCredentials(address student) external view returns (uint256[] memory) {
        return studentCredentials[student];
    }

    /// @notice Paginated alternative for applications with large student histories.
    function getStudentCredentialsPage(address student, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory page)
    {
        if (limit == 0 || limit > MAX_PAGE_SIZE) revert InvalidPageSize();
        uint256[] storage ids = studentCredentials[student];
        if (offset >= ids.length) return new uint256[](0);

        uint256 remaining = ids.length - offset;
        uint256 count = remaining < limit ? remaining : limit;
        page = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            page[i] = ids[offset + i];
        }
    }

    // ---------------------------------------------------------------------
    // Public verification
    // ---------------------------------------------------------------------

    function getCredentialIdByHash(bytes32 certHash) public view returns (uint256 credentialId) {
        if (certHash == bytes32(0)) revert EmptyHash();
        uint256 credentialIdPlusOne = credentialIdPlusOneByHash[certHash];
        if (credentialIdPlusOne == 0) revert CertificateHashNotFound();
        return credentialIdPlusOne - 1;
    }

    function verifyCredentialByHash(bytes32 certHash)
        external
        view
        returns (
            uint256 credentialId,
            address institution,
            address student,
            uint256 issuedAt,
            bool isValid
        )
    {
        credentialId = getCredentialIdByHash(certHash);
        Credential storage credential = credentials[credentialId];
        return (credentialId, credential.institution, credential.student, credential.issuedAt, !credential.revoked);
    }

    function verifyCredential(uint256 credentialId)
        external
        view
        returns (bytes32 certHash, address institution, address student, uint256 issuedAt, bool isValid)
    {
        if (credentialId >= nextCredentialId) revert InvalidCredential();
        Credential storage credential = credentials[credentialId];
        return (
            credential.certHash,
            credential.institution,
            credential.student,
            credential.issuedAt,
            !credential.revoked
        );
    }
}
