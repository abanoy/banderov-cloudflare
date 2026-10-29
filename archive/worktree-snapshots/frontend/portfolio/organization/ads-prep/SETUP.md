# AdSense preparation — local and disabled

Prepared 2026-10-16. No AdSense, Stripe or Yoti account has been provisioned, connected or tested. No live advertising, checkout, ads.txt, production routing or deployment was added. The backend remains owner-paused.

## Owner policy and open terms

- Optional ad removal covers **all games hosted on banderov.com**, not a per-game purchase. Anonymous ad-supported play remains possible. Every registered account must complete verified **18+ Yoti** registration; this is not an adult-gallery feature.
- Local proposal: **$5 USD, one-time payment, no recurring billing**. USD follows the owner's recorded 5 USD discussion. Final duration, taxes, refunds/disputes and transfer/deletion behavior must be confirmed before a real checkout is offered. Do not advertise “lifetime” or promise future/external-platform coverage.
- The benefit suppresses our site's ad loader. It cannot remove YouTube's own ads, portal SDK advertising or third-party platform ads. Existing standalone Don NoAds and its separate Y8 variant stay distinct. No new ad code belongs in those immutable exports.
- Planned adult gallery was dropped. Preserve private originals and their access boundaries; do not publish or delete them as part of monetization.

## Inspect locally

Run the existing portfolio `preview.mjs`, then open `/monetization/preview.html`. All scenario controls are **mock server/CMP fixtures**, not a registration, payment or real consent system. Mock loading counters demonstrate the gate. The live provider config is disabled with null IDs. Files are not imported by the public portfolio or any live game.

Choose paid before applying: loader calls must remain zero. Pending account/payment, failed service, expired responses, incomplete registration and declined/unavailable consent must also load zero ad scripts. The unpaid/allowed scenario renders only a local neutral placeholder. Mock checkout return stays pending until the separate simulated-server confirmation action. A previously ad-supported page needs a clean reload after a purchase; clearing a banner cannot undo a third-party script that already ran.

## Placement and consent

Use manually controlled **responsive display units**, never automatic overlays or interstitials around gameplay. This preview reserves a 180 CSS-pixel gap after the complete game/control/support area, and uses a clearly labeled non-clickable placeholder. Verify actual geometry at every target size before any live placement; no placement in menus, HUD, virtual joysticks, page-turn controls or YouTube player controls. Paid/unknown states collapse the whole ad zone. No layout shift into a game surface is acceptable.

Google recommends at least 150 pixels between display content ads and games, or omitting them on gameplay pages. It also requires obvious play links and warns against deceptive ad-dominated transitions. See [Google's gameplay placement guidance](https://support.google.com/adsense/answer/2768340?hl=en). The 180-pixel gap is our conservative local design choice, not a guarantee of Google approval.

Our mock consent selection is **not a CMP**. Before enabling ads, integrate a suitable Google-certified CMP and applicable regional privacy choices, with consent resolved before the AdSense loader. Google requires a certified CMP integrating with TCF for personalized advertising in the EEA, UK and Switzerland: [Google CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en). Do not treat a homemade checkbox, a “non-personalized” flag or purchasing as consent. Unknown/denied consent withholds ads and leaves play available. Resolve account entitlement before requesting even an ad-related CMP, so known paid accounts avoid that ad path.

## Owner setup, after prerequisites are implemented

1. Confirm the offer's currency, one-time term, refund/dispute policy and scope; publish truthful privacy/consent and purchase terms. Resolve provider eligibility and review requirements without claiming approval in advance.
2. In the owner's AdSense account, add/review `banderov.com` and create a responsive **Display** unit for the reviewed placement. Keep Auto ads off for this manually controlled arrangement. Account verification/review and public activation need separate owner authorization; this preparation performs neither.
3. Obtain the **real** publisher ID and unit ID from Google. `config.js` intentionally contains `enabled:false`, `publisherId:null` and `unitIds.afterGame:null`. Do not replace these with made-up identifiers or enable the loader as a way to test placeholders. Publisher/unit IDs are public configuration, but Stripe/Yoti secrets must remain server-side and out of these files.
4. Copy the exact seller line supplied by the owner's account when preparing root `/ads.txt`. A non-deployable shape is `google.com, <REAL_PUB_ID_FROM_GOOGLE>, DIRECT, f08c47fec0942fa0`. The angle-bracket token is explanatory, not a real seller and must never be uploaded. Google's guide explains root placement and validation: [ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en). Preserve any existing authorized seller lines after checking the actual file. No ads.txt file was created here.
5. Implement and test the contracts in `MONETIZATION-CONTRACT.md`: persistent verified accounts, session/CSRF controls, hosted checkout, authenticated webhook fulfillment and durable account entitlement. **Backend is paused**; do not wake or silently implement it from this guide. Failed/unknown responses must withhold ads rather than assume the customer is unpaid.
6. Connect the CMP adapter and then the centralized controller/provider. Recheck the account after the consent dialog. Supply real IDs only in a separately reviewed activation. Paid entry paths must make **zero** ad-SDK requests; hiding already rendered units is insufficient. Reload an already ad-supported page once a newly confirmed purchase is effective.
7. Review site-game launch wrappers individually. Do not overwrite raw game builds, pins, multiplayer origins or the distributor root. Raw current builds remain unchanged and ad-free where originally delivered; no wrapper enforcement or ad coverage across all games exists yet. Future routing/wrapper changes require explicit approval. Do not turn this into a paywall or claim anti-bypass enforcement.
8. On an authorized release, capture actual deployed modules/settings/assets first. Preserve one Worker, apex portfolio, exact workers.dev Don BUILD47 root/index, image/privacy/music, Room/Lobby/Guard and all 13 origins. Do not compile unrelated pending backend. Keep contracts/mock controls out of public release lists; no deployment package was prepared here.

## Remaining prerequisites

There is no completed account/Yoti/checkout/webhook/entitlement/CMP implementation behind this preview. Google site/ad approval and actual fills, Stripe eligibility/charges/refunds, Yoti live verification, real edge sessions and physical-device ad behavior remain unverified. No secrets, live IDs, provider setup, charges or public publication are authorized by this local task.

Code homes: `projects/portfolio/monetization/` for this frontend preparation; shared setup and future server contracts in `docs/portfolio/`. The production adapter's endpoint name is a proposal, not a live route. Ordinary pages do not load these modules.


## Coordination update — 2026-10-16

The owner resumed Backend for focused verified 18+ Yoti accounts and Stripe one-time USD 5 site-wide ad removal. Older paused-backend statements above are superseded for this focused task. Frontend owns portfolio UI/ad gating; Backend owns authentication, verification, persistence and payments. The proposed endpoint below is pending reconciliation with Backend GET `/api/account/current`; it is not an implemented live API.

Owner supplied public publisher identifier `ca-pub-6772183071188886`, account meta tag and seller line `google.com, pub-6772183071188886, DIRECT, f08c47fec0942fa0`. Local configuration records the real publisher ID but remains disabled, with manual unit ID null. No unconditional ad script is installed. `ads.txt` is a locally staged root candidate only, not published. Actual manual display unit IDs, site review, certified consent integration, confirmed purchase terms and explicit publication/activation remain prerequisites. Auto ads must remain off; no dashboard setting was changed.
