// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// Chainlink CRE receiver interface: the forwarder calls onReport with the workflow's signed report.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// The onchain record of grades verified by the Chainlink CRE workflow `slab-attest`.
/// Every node of the oracle network looks the certificate up in the grader registry, the nodes agree on one result, and
/// the forwarder delivers the signed report here. The attestor relay lists a cert in SlabVault only when this contract
/// holds a matching record, so the grade that creates a token comes from the oracle network, not from the depositor.
/// The report carries exactly SlabVault.attest's arguments.
contract GradeOracle is IReceiver {
    struct Grade {
        uint256 specId;
        uint8 grade;
        address holder;
        uint64 at;
    }

    address public immutable owner;
    /// MockKeystoneForwarder for CLI simulation, the KeystoneForwarder on a deployed workflow.
    address public forwarder;
    mapping(uint256 => Grade) public grades;

    event GradeVerified(uint256 indexed certId, uint256 indexed specId, uint8 grade, address indexed holder, string name, string symbol);
    event ForwarderSet(address forwarder);

    constructor(address forwarder_) {
        owner = msg.sender;
        forwarder = forwarder_;
        emit ForwarderSet(forwarder_);
    }

    /// Switch from the simulation forwarder to the production one when the workflow is deployed.
    function setForwarder(address forwarder_) external {
        require(msg.sender == owner, "only owner");
        forwarder = forwarder_;
        emit ForwarderSet(forwarder_);
    }

    // NOTE: trusts the forwarder alone; the production KeystoneForwarder checks the oracle network's signatures. Limit:
    // a deployed workflow should also pin its workflow ID and owner from `metadata`.
    function onReport(bytes calldata, bytes calldata report) external {
        require(msg.sender == forwarder, "only forwarder");
        (uint256 certId, uint256 specId, uint8 grade, address holder, string memory name, string memory symbol) =
            abi.decode(report, (uint256, uint256, uint8, address, string, string));
        require(grades[certId].at == 0, "cert already verified");
        require(grade >= 1 && grade <= 10, "bad grade");
        grades[certId] = Grade(specId, grade, holder, uint64(block.timestamp));
        emit GradeVerified(certId, specId, grade, holder, name, symbol);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
