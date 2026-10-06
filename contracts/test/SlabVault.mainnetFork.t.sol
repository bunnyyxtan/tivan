// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SlabVault, IKuruRouter} from "../src/SlabVault.sol";

interface IOwned {
    function owner() external view returns (address);
}

/// Kuru mainnet gates market deployment to its owner. forge test --match-contract Mainnet --fork-url https://rpc.monad.xyz
contract SlabVaultMainnetForkTest is Test {
    IKuruRouter constant ROUTER = IKuruRouter(0xd651346d7c789536ebf06dc72aE3C8502cd695CC);
    address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    SlabVault vault;
    address attestor = makeAddr("attestor");

    function setUp() public {
        vault = new SlabVault(ROUTER, USDC, attestor, attestor, SlabVault.MarketParams(1, 100, 1, 1, 1000, 0, 0, 30));
        vm.prank(attestor);
        vault.attest(1, 4, 10, attestor, "PSA 10 Charizard", "PSA10-CHZ");
    }

    function test_attestSurvivesGatedRouterThenLinks() public {
        bytes32 sku = vault.skuOf(4, 10);
        (address token, address market,) = vault.skuInfo(sku);
        assertTrue(token != address(0));
        assertEq(market, address(0), "pending until Kuru deploys");

        vm.prank(IOwned(address(ROUTER)).owner());
        address kuruMarket = ROUTER.deployProxy(0, token, USDC, 1, 100, 1, 1, 1000, 0, 0, 30);
        vault.linkMarket(sku, kuruMarket);
        (, market,) = vault.skuInfo(sku);
        assertEq(market, kuruMarket);
    }

    function test_rejectsForeignMarket() public {
        bytes32 sku = vault.skuOf(4, 10);
        vm.expectRevert("not this sku's kuru market");
        vault.linkMarket(sku, 0x065C9d28E428A0db40191a54d33d5b7c71a9C394); // MON-USDC
    }
}
