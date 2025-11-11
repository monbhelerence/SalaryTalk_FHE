pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract SalaryTalk_FHE is ZamaEthereumConfig {
    struct Negotiation {
        address employer;
        address candidate;
        euint32 encryptedMinSalary;
        euint32 encryptedMaxSalary;
        uint32 decryptedMinSalary;
        uint32 decryptedMaxSalary;
        bool isEmployerVerified;
        bool isCandidateVerified;
        bool hasOverlap;
    }

    mapping(bytes32 => Negotiation) public negotiations;
    bytes32[] public negotiationIds;

    event NegotiationCreated(bytes32 indexed id, address indexed employer, address indexed candidate);
    event EmployerDecryptionVerified(bytes32 indexed id, uint32 minSalary);
    event CandidateDecryptionVerified(bytes32 indexed id, uint32 maxSalary);
    event OverlapResult(bytes32 indexed id, bool hasOverlap);

    constructor() ZamaEthereumConfig() {}

    function createNegotiation(
        externalEuint32 encryptedMinSalary,
        bytes calldata employerProof,
        externalEuint32 encryptedMaxSalary,
        bytes calldata candidateProof,
        address candidate
    ) external {
        bytes32 negotiationId = keccak256(abi.encodePacked(msg.sender, candidate, block.timestamp));

        require(negotiations[negotiationId].employer == address(0), "Negotiation already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedMinSalary, employerProof)), "Invalid employer input");
        require(FHE.isInitialized(FHE.fromExternal(encryptedMaxSalary, candidateProof)), "Invalid candidate input");

        euint32 encryptedMin = FHE.fromExternal(encryptedMinSalary, employerProof);
        euint32 encryptedMax = FHE.fromExternal(encryptedMaxSalary, candidateProof);

        FHE.allowThis(encryptedMin);
        FHE.allowThis(encryptedMax);
        FHE.makePubliclyDecryptable(encryptedMin);
        FHE.makePubliclyDecryptable(encryptedMax);

        negotiations[negotiationId] = Negotiation({
            employer: msg.sender,
            candidate: candidate,
            encryptedMinSalary: encryptedMin,
            encryptedMaxSalary: encryptedMax,
            decryptedMinSalary: 0,
            decryptedMaxSalary: 0,
            isEmployerVerified: false,
            isCandidateVerified: false,
            hasOverlap: false
        });

        negotiationIds.push(negotiationId);
        emit NegotiationCreated(negotiationId, msg.sender, candidate);
    }

    function verifyEmployerDecryption(
        bytes32 negotiationId,
        bytes memory abiEncodedMinSalary,
        bytes memory decryptionProof
    ) external {
        Negotiation storage n = negotiations[negotiationId];
        require(n.employer == msg.sender, "Only employer can verify");
        require(!n.isEmployerVerified, "Employer already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(n.encryptedMinSalary);

        FHE.checkSignatures(cts, abiEncodedMinSalary, decryptionProof);
        uint32 minSalary = abi.decode(abiEncodedMinSalary, (uint32));

        n.decryptedMinSalary = minSalary;
        n.isEmployerVerified = true;
        emit EmployerDecryptionVerified(negotiationId, minSalary);

        if (n.isCandidateVerified) {
            checkOverlap(negotiationId);
        }
    }

    function verifyCandidateDecryption(
        bytes32 negotiationId,
        bytes memory abiEncodedMaxSalary,
        bytes memory decryptionProof
    ) external {
        Negotiation storage n = negotiations[negotiationId];
        require(n.candidate == msg.sender, "Only candidate can verify");
        require(!n.isCandidateVerified, "Candidate already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(n.encryptedMaxSalary);

        FHE.checkSignatures(cts, abiEncodedMaxSalary, decryptionProof);
        uint32 maxSalary = abi.decode(abiEncodedMaxSalary, (uint32));

        n.decryptedMaxSalary = maxSalary;
        n.isCandidateVerified = true;
        emit CandidateDecryptionVerified(negotiationId, maxSalary);

        if (n.isEmployerVerified) {
            checkOverlap(negotiationId);
        }
    }

    function checkOverlap(bytes32 negotiationId) private {
        Negotiation storage n = negotiations[negotiationId];
        require(n.isEmployerVerified && n.isCandidateVerified, "Both parties must be verified");

        n.hasOverlap = n.decryptedMinSalary <= n.decryptedMaxSalary;
        emit OverlapResult(negotiationId, n.hasOverlap);
    }

    function getNegotiation(bytes32 negotiationId) external view returns (
        address employer,
        address candidate,
        uint32 decryptedMinSalary,
        uint32 decryptedMaxSalary,
        bool isEmployerVerified,
        bool isCandidateVerified,
        bool hasOverlap
    ) {
        Negotiation storage n = negotiations[negotiationId];
        require(n.employer != address(0), "Negotiation does not exist");

        return (
            n.employer,
            n.candidate,
            n.decryptedMinSalary,
            n.decryptedMaxSalary,
            n.isEmployerVerified,
            n.isCandidateVerified,
            n.hasOverlap
        );
    }

    function getAllNegotiationIds() external view returns (bytes32[] memory) {
        return negotiationIds;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


