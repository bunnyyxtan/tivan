// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlabToken} from "./SlabToken.sol";

interface IKuruRouter {
    function deployProxy(
        uint8 _type,
        address _baseAssetAddress,
        address _quoteAssetAddress,
        uint96 _sizePrecision,
        uint32 _pricePrecision,
        uint32 _tickSize,
        uint96 _minSize,
        uint96 _maxSize,
        uint256 _takerFeeBps,
        uint256 _makerFeeBps,
        uint96 _kuruAmmSpread
    ) external returns (address proxy);

    function verifiedMarket(address market)
        external
        view
        returns (
            uint32,
            uint96,
            address base,
            uint256,
            address quote,
            uint256,
            uint32,
            uint96,
            uint96,
            uint256,
            uint256
        );
}

/// Graded cards in, fungible per-(card, grade) tokens out, each SKU with its own Kuru order book.
contract SlabVault {
    enum Status {
        None,
        Attested,
        Vaulted,
        Redeemed
    }

    struct Cert {
        bytes32 sku;
        address holder;
        Status status;
    }

    struct Sku {
        SlabToken token;
        address market;
        uint256[] queue; // vaulted cert ids, redeemed FIFO so nobody can cherry-pick the best copy
        uint256 head;
    }

    struct MarketParams {
        uint96 sizePrecision;
        uint32 pricePrecision;
        uint32 tickSize;
        uint96 minSize;
        uint96 maxSize;
        uint256 takerFeeBps;
        uint256 makerFeeBps;
        uint96 kuruAmmSpread;
    }

    IKuruRouter public immutable router;
    address public immutable quote; // AUSD on mainnet
    // NOTE: single attestor + custodian; swap attestor for the CRE forwarder once CRE ships production on Monad
    address public immutable attestor;
    address public immutable custodian;
    MarketParams public params;

    mapping(uint256 => Cert) public certs;
    mapping(bytes32 => Sku) internal skus;

    event Attested(uint256 indexed certId, bytes32 indexed sku, address indexed holder);
    event SkuListed(bytes32 indexed sku, address token, address market, string name);
    event Vaulted(uint256 indexed certId, bytes32 indexed sku, address indexed holder);
    event MarketLinked(bytes32 indexed sku, address market);
    event Redeemed(uint256 indexed certId, bytes32 indexed sku, address indexed holder, bytes32 shippingHash);

    constructor(IKuruRouter router_, address quote_, address attestor_, address custodian_, MarketParams memory p) {
        router = router_;
        quote = quote_;
        attestor = attestor_;
        custodian = custodian_;
        params = p;
    }

    function skuOf(uint256 specId, uint8 grade) public pure returns (bytes32) {
        return keccak256(abi.encode(specId, grade));
    }

    /// Grade verified against the grader's registry (CRE workflow). `name`/`symbol` only used on a SKU's first listing.
    function attest(
        uint256 certId,
        uint256 specId,
        uint8 grade,
        address holder,
        string calldata name,
        string calldata symbol
    ) external {
        require(msg.sender == attestor, "only attestor");
        require(certs[certId].status == Status.None, "cert known");
        bytes32 sku = skuOf(specId, grade);
        certs[certId] = Cert(sku, holder, Status.Attested);
        if (address(skus[sku].token) == address(0)) _list(sku, name, symbol);
        emit Attested(certId, sku, holder);
    }

    /// Physical card received: mint one token to the depositor.
    function confirmCustody(uint256 certId) external {
        require(msg.sender == custodian, "only custodian");
        Cert storage c = certs[certId];
        require(c.status == Status.Attested, "not attested");
        c.status = Status.Vaulted;
        Sku storage s = skus[c.sku];
        s.queue.push(certId);
        s.token.mint(c.holder);
        emit Vaulted(certId, c.sku, c.holder);
    }

    /// Burn one token, claim the oldest vaulted card of that SKU. Shipping details stay offchain, committed by hash.
    function redeem(bytes32 sku, bytes32 shippingHash) external returns (uint256 certId) {
        Sku storage s = skus[sku];
        require(s.head < s.queue.length, "nothing vaulted");
        certId = s.queue[s.head++];
        s.token.burn(msg.sender);
        certs[certId].status = Status.Redeemed;
        certs[certId].holder = msg.sender;
        emit Redeemed(certId, sku, msg.sender, shippingHash);
    }

    function skuInfo(bytes32 sku) external view returns (address token, address market, uint256 vaulted) {
        Sku storage s = skus[sku];
        return (address(s.token), s.market, s.queue.length - s.head);
    }

    /// For routers where market deployment is gated (Kuru mainnet): link a market Kuru deployed for this SKU.
    /// Permissionless because the router itself vouches the market trades this SKU against our quote token.
    function linkMarket(bytes32 sku, address market) external {
        Sku storage s = skus[sku];
        require(address(s.token) != address(0) && s.market == address(0), "no pending sku");
        (,, address base,, address q,,,,,,) = router.verifiedMarket(market);
        require(base == address(s.token) && q == quote, "not this sku's kuru market");
        s.market = market;
        emit MarketLinked(sku, market);
    }

    function _list(bytes32 sku, string calldata name, string calldata symbol) internal {
        SlabToken token = new SlabToken(name, symbol);
        skus[sku].token = token;
        address market = _deployMarket(token); // zero when the router gates deployment; link later
        skus[sku].market = market;
        emit SkuListed(sku, address(token), market, name);
    }

    function _deployMarket(SlabToken token) internal returns (address) {
        MarketParams memory p = params;
        try router.deployProxy(
            0, // NO_NATIVE: ERC20 base and quote
            address(token),
            quote,
            p.sizePrecision,
            p.pricePrecision,
            p.tickSize,
            p.minSize,
            p.maxSize,
            p.takerFeeBps,
            p.makerFeeBps,
            p.kuruAmmSpread
        ) returns (
            address market
        ) {
            return market;
        } catch {
            return address(0);
        }
    }
}
