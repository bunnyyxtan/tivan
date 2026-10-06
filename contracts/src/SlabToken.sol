// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// One token = one vaulted graded card of a single (card, grade) SKU. Whole units only.
contract SlabToken is ERC20 {
    address public immutable vault;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        vault = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function mint(address to) external {
        require(msg.sender == vault, "only vault");
        _mint(to, 1);
    }

    function burn(address from) external {
        require(msg.sender == vault, "only vault");
        _burn(from, 1);
    }
}
