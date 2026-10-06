// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SlabVault, IKuruRouter} from "../src/SlabVault.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
/// Env: DEPLOYER_KEY, KURU_ROUTER, QUOTE, ATTESTOR, CUSTODIAN
contract Deploy is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));
        SlabVault vault = new SlabVault(
            IKuruRouter(vm.envAddress("KURU_ROUTER")),
            vm.envAddress("QUOTE"),
            vm.envAddress("ATTESTOR"),
            vm.envAddress("CUSTODIAN"),
            // whole cards, prices in cents, 0.3% backstop AMM spread
            SlabVault.MarketParams(1, 100, 1, 1, 1000, 0, 0, 30)
        );
        vm.stopBroadcast();
        console.log("SlabVault", address(vault));
    }
}
