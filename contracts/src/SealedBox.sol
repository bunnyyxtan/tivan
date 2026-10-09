// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Untrusted storage for passkey-sealed data. It holds ciphertext only.
/// In the browser, one passkey under the vault's own salt yields three things through HKDF: the AES key that seals the box,
/// the locator that says where it lives, and a "keeper" key that authorises writes. None is stored anywhere; the passkey
/// rebuilds all three on any device. The keeper is not the person's trading account, so a box is not linked to their
/// address on chain, and anyone (Tivan's relay, which pays the gas) can submit a write the keeper signed.
contract SealedBox {
    uint256 public constant MAX_SIZE = 4096;
    uint256 private constant HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    mapping(bytes32 => bytes) public boxOf;
    /// The keeper registered by a locator's first write; only its signature can replace the box.
    mapping(bytes32 => address) public keeperOf;
    /// Next nonce per locator, so a signed write cannot be replayed.
    mapping(bytes32 => uint256) public nonceOf;

    event Sealed(bytes32 indexed locator, address indexed keeper, uint256 nonce, uint256 size);

    /// The hash the keeper signs (as an EIP-191 personal message over these 32 bytes).
    function writeHash(bytes32 locator, bytes calldata box, uint256 nonce) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, locator, keccak256(box), nonce));
    }

    function put(bytes32 locator, bytes calldata box, uint256 nonce, bytes calldata sig) external {
        require(box.length <= MAX_SIZE, "box too large");
        require(nonce == nonceOf[locator], "stale nonce");
        address signer = _recover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", writeHash(locator, box, nonce))), sig);
        address keeper = keeperOf[locator];
        if (keeper == address(0)) keeperOf[locator] = signer;
        else require(signer == keeper, "not your box");
        nonceOf[locator] = nonce + 1;
        boxOf[locator] = box;
        emit Sealed(locator, signer, nonce, box.length);
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address signer) {
        require(sig.length == 65, "bad signature");
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        require(uint256(s) <= HALF_N && (v == 27 || v == 28), "bad signature");
        signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "bad signature");
    }
}
