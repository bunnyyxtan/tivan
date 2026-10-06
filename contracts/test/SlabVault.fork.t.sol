// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SlabVault, IKuruRouter} from "../src/SlabVault.sol";

interface IOrderBook {
    function addSellOrder(uint32 price, uint96 size, bool postOnly) external;
    function placeAndExecuteMarketBuy(uint96 quoteSize, uint256 minOut, bool isMargin, bool fillOrKill)
        external
        returns (uint256);
    function bestBidAsk() external view returns (uint256, uint256);
}

interface IMarginAccount {
    function deposit(address user, address token, uint256 amount) external payable;
}

/// Runs against real Kuru contracts on a Monad testnet fork: forge test --fork-url https://testnet-rpc.monad.xyz
contract SlabVaultForkTest is Test {
    IKuruRouter constant ROUTER = IKuruRouter(0x7EFbE105Ca7415dE98F96622173458ac1c054630);
    IMarginAccount constant MARGIN = IMarginAccount(0xd029C2D98ff85D8F64799017fE00a59B1159CE02);
    address constant USDC = 0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570;

    SlabVault vault;
    address attestor = makeAddr("attestor");
    address custodian = makeAddr("custodian");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");

    function setUp() public {
        vault = new SlabVault(
            ROUTER,
            USDC,
            attestor,
            custodian,
            // whole cards (0 decimals), prices in cents
            SlabVault.MarketParams(1, 100, 1, 1, 1000, 0, 0, 30)
        );
    }

    function _vaultOne(uint256 certId, address holder) internal returns (bytes32 sku) {
        vm.prank(attestor);
        vault.attest(certId, 4, 10, holder, "PSA 10 Base Set Charizard", "PSA10-CHZ");
        vm.prank(custodian);
        vault.confirmCustody(certId);
        return vault.skuOf(4, 10);
    }

    function test_listAndTradeWholeCard() public {
        bytes32 sku = _vaultOne(111, seller);
        (address token, address market, uint256 vaulted) = vault.skuInfo(sku);
        assertEq(IERC20(token).balanceOf(seller), 1);
        assertEq(vaulted, 1);
        assertTrue(market.code.length > 0, "kuru market deployed");

        // seller lists the card at $420.00
        vm.startPrank(seller);
        IERC20(token).approve(address(MARGIN), 1);
        MARGIN.deposit(seller, token, 1);
        IOrderBook(market).addSellOrder(42000, 1, true);
        vm.stopPrank();
        (, uint256 ask) = IOrderBook(market).bestBidAsk();
        emit log_named_uint("best ask", ask);

        // buyer takes it with USDC
        deal(USDC, buyer, 420e6);
        vm.startPrank(buyer);
        IERC20(USDC).approve(market, 420e6);
        uint256 got = IOrderBook(market).placeAndExecuteMarketBuy(42000, 0, false, true);
        vm.stopPrank();
        emit log_named_uint("filled", got);
        assertEq(IERC20(token).balanceOf(buyer), 1);
    }

    function test_redeemIsFifo() public {
        bytes32 sku = _vaultOne(111, seller);
        _vaultOne(222, buyer);
        vm.prank(buyer);
        uint256 certId = vault.redeem(sku, keccak256("ship-to"));
        assertEq(certId, 111, "oldest card goes out first");
    }

    function test_onlyRolesCanMint() public {
        vm.expectRevert("only attestor");
        vault.attest(1, 4, 10, seller, "x", "x");
        vm.prank(attestor);
        vault.attest(1, 4, 10, seller, "x", "x");
        vm.expectRevert("only custodian");
        vault.confirmCustody(1);
    }
}
