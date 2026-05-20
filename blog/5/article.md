![An image of Tech Updates](Tech_updates.webp)

# Liberdus Updates May 18th, 2026

Updates on what the Liberdus team has done in the past week.Including LP staking migration upgrades and improved bridge infrastructure 
to wallet refinements, RPC resilience work, signer tooling, social onboarding improvements and major UX upgrades across the ecosystem.

- LP Staking migration (BSC):** found 2 issues when rotating ownership        
  - Contract lacked an owner-transfer function.
  - The BSC deployment was missing newer “runway / rewards allocation” functionality.
- Updated staking contract to use **Ownable2Step** (standard owner ops + 2-step transfer) and deployed the updated version to **BSC testnet + mainnet**.
- Built migration UX:
  - A “migration” site that only allows **unstake + claim** (old contract), with a banner guiding users to withdraw and restake into the new farm (“farm 1.0 → farm 2.0”).
  - Main farm site will show a banner only when relevant (e.g., if your wallet has a position in the old contract).
  - Next steps: deploy the updated farm UI + banners, run multisig steps to configure rewards (pair rewards + reward/hour), then announce to the community
- **Bridge UI:** fixed update-signer op call by always passing the required (unused) “data” param as `0x`.
- **Social signup page:** OAuth flows (Discord/Telegram/X/LinkedIn) are working; added “edit existing signup” flow so users can update linked accounts + even swap wallets; final polish is clarifying requirement = **wallet + at least one social login**.
- Migrating from public Chainlist RPCs → **API-key (free tier) RPC providers** per TSS signer for reliability and resilience.
- Pricing + provider capability analysis (esp. for `eth_getLogs`, block-range limits, and rate limiting).
- Plan: implement **round-robin RPC usage** inside TSS signer and keep multiple providers per signer (plus potential backup keys).
- Investigating recurring issue where a tx “second attempt” sometimes fails and requires restart; now reproducible and will debug further with logs + remote server reproduction.
- Prepared for deploying latest TSS signer:
  - Split **observer list** out of `chainConfig.json` into its own JSON for easier updates.
  - Added logic to avoid gossiping to itself (self-observer detection).
- Deployment hit a strange case where signatures weren’t produced even though signers were “present” in the time window → added features to **collect logs across signers/RPCs** to speed debugging.
- Added operational tooling:
  - “Restart other signers” support for stuck network cases.
  - A “software update” feature to push updates more easily during testing (intended to disable later).
- **Android app:** submitted a new build including the location feature (previously blocked on account/license agreement).
- **Transfer tx fee option:** continued work on “deduct fee from transfer amount” support (important for signer/bridge fee accounting).
- Wallet module refinements: improved wallet selection/authorization behavior; fixed Playwright stability by selecting a specific wallet ID in tests.
- Started migrating the unified wallet module into other UIs; hit an issue copying vendor/new files into WhaleSwap UI.
- LP staking UI improvements:
  - Clearer wallet error feedback + support links (including footer links).
  - **Duplicate toast suppression** (can’t spam the same “wallet not connected” error repeatedly).
  - Shows LP value with **USD estimates** using contract data + price APIs.
  - Added a guided **Remove LP** flow:
  - Preview → approve → remove Uniswap V2 liquidity.
  - Optional Kyber **Zap-out** checkbox to convert withdrawn tokens into a preferred token (fewer steps for users).
  - Improved previews + slippage warnings when custom slippage is high.
- Started “recipient-aware” claim/unstake support (route rewards/LP to a selected recipient when contract supports it); waiting on updated contract merge to fully test.
        
        
