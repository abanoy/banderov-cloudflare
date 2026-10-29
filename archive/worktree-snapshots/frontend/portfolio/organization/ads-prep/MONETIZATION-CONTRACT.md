# Proposed account / consent / payment boundary

Local frontend contract, 2026-10-16. **Not an implemented backend API.** Backend remains paused. Stripe is proposed, not provisioned. Existing shared Worker, game and account/privacy/session boundaries must be preserved when that work is explicitly resumed.

## Read account monetization status

Proposed `GET /api/account/monetization`, same-origin authenticated HttpOnly/Secure session, `Cache-Control: no-store`; avoid shared/CDN caches and cross-user reuse. Anonymous reads may return an explicit anonymous record. Do not accept a client user ID or paid flag. Minimal response:

```json
{
  "version": 1,
  "viewer": "account",
  "ageVerification": "yoti_verified_18plus",
  "checkedAt": "2026-10-16T12:00:00Z",
  "validUntil": "2026-10-16T12:01:00Z",
  "entitlement": {"state": "active", "scope": "all_site_games"},
  "adsEligible": false
}
```

This is a **schema example**, not evidence of a real account. Viewer values: anonymous, account, registration_pending. Registration-pending is a pre-account flow, not permission to issue an active account session. All active accounts need verified18+ Yoti results established by the server, not a DOB checkbox, redirect/query or browser flag. Do not expose DOB, identity documents, biometric details, Yoti tokens or payment identifiers in the ad response.

Entitlement: active / none / pending. A server-verified active `all_site_games` entitlement suppresses the ad path across hosted site-game placements without individual game SKUs. Anonymous + active is invalid. Unknown, stale, malformed, pending and error states **withhold all ad loading**; no payment/network error can silently turn a paid viewer into an unpaid one. Frontend freshness limit120seconds; a60second validity is illustrated. Server revocation and account/session policy remain authoritative.

For anonymous supported play, return explicit `viewer:anonymous`, `entitlement.state:none`, `adsEligible:true` with fresh times; registration is optional for that play but mandatory/verified18+ for any account and ad-removal purchase. Incomplete registrations do not become accounts just to serve ads.

`getServerMonetization` is only a proposed read adapter. No server route was added. Client policy checks are UI behavior, **not** an authorization boundary or cryptographic proof. A user may modify their browser; it must not grant backend entitlements. Do not use localStorage, success URL parameters, a returned Checkout Session ID or an unsigned message as proof.

## Consent and loader ordering

1. Resolve fresh account entitlement before loading ad SDKs or an ad-related CMP.
2. Known paid: skip loader/mount entirely. No Google ad script, queue push or unit request.
3. Explicit unpaid: query the real CMP adapter. Unknown or denied means no ads, game usable.
4. After an async consent dialog, reread the server entitlement before the first ad SDK request. If now paid/pending/error, stop.
5. Only then may configured manual units load. Each page uses the centralized provider once. Epoch cancellation stops stale async completions from rendering after a newer state.
6. Already-requested third-party JavaScript cannot be undone. On account switch, consent withdrawal or successful upgrade, stop units and request a clean page reload. A known paid page must begin without the SDK. Never describe banner removal as proof no SDK ran.

The live CMP adapter is intentionally absent. The mock fixture returns `source:cmp_adapter` solely for tests; it is not a real consent signal. Production integration must obtain the provider's real consent state and pass required signals, not trust a DOM flag or local storage. There is no live activation wiring in public pages.

## Proposed checkout / fulfillment

Proposed `POST /api/billing/site-ad-removal/checkout`, authenticated verified18+ account, same-origin/CSRF enforcement and abuse bounds. Client sends only a reviewed offer code (`site_games_no_ads_v1`), not price/currency/user ID. Server catalog proposal:500minor USD units, `mode:payment`, one-time; never subscription mode. Confirm exact duration/refunds/taxes before enabling this offer. Backend binds provider session/order to the authenticated account and a server-side order record.

On a return URL, show “confirming payment” and query the server. A canceled/failed/abandoned/delayed payment cannot grant access. Poll for a bounded period, then provide a manual status retry rather than reload an unverified claim into a paid state. No Checkout flow is actually created by this preparation.

Fulfillment must authenticate the provider webhook on the raw request body, check signature freshness, retrieve/validate provider payment state, account/order binding, offer, expected500USDminor amount/currency/mode and actual paid completion. Idempotently record processed events and grant the account-scoped entitlement atomically with the order update. Handle duplicate/reordered events and delayed payment outcomes; mark paid only on verified success. Refunds/disputes/revocation need an owner-approved policy and corresponding authoritative status updates. Do not silently retain access or remove it based only on a browser error. Return promptly after durable acceptance; complete retries safely. Never put webhook secrets or raw provider payloads into public source/logs.

Stripe explains webhook-based fulfillment and signature verification here: [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks). The account binding, SKU and atomic persistence requirements above are our proposed integration contract, not a claim that Stripe or the paused backend already implements them for this project.

## Yoti / privacy prerequisite

Reuse only an explicitly reviewed server-side Yoti18+ verification architecture, updated from earlier16+ foundations if necessary. Persistent registration needs opaque pre-registration state, provider result verification/retrieval, replay protection, expiry, account binding and final18+ decision before account activation. Keep provider secrets and original personal documents private, store only the necessary durable eligibility evidence under the agreed retention rules, and preserve existing session/origin/rate limits. This document does not implement or certify a Yoti provider method, account or sandbox/live interoperability.

No adult gallery is planned. Private adult originals stay protected and undeleted. Removing that gallery does not eliminate the mandatory18+ account policy or authorize a content upload.

## Acceptance before a future live release

- Initial paid entry: zero ad-SDK/CMP requests and zero ad queue calls; pending/error/expired also zero.
- Anonymous/unpaid + genuine CMP allowance + approved IDs: a single loader, reviewed manual slots only, no gameplay overlap; refusal still allows play.
- Purchase return with no webhook: pending, no entitlement. Verified server confirmation then clean paid reload: zero loader requests.
- Webhook duplicate/replay/invalid signature, wrong account/amount/currency/offer and failed/delayed payment: no incorrect grant; refund policy tested.
- Account changes and consent races cannot mount stale units. Privacy/account errors do not load ads by default. Missing IDs/approval disable live provider.
- All hosted game wrappers audited for integration; exact current distributor/game builds and NoAds/Y8 variants preserved. No claims about external ads or future service coverage.
- Source/mock tests do not prove Google approval/fill, real CMP compliance, Yoti interoperability, payment processing or server authority. Those need separate owner-approved backend/provider and publication work.


## Coordination update — 2026-10-16

The owner resumed Backend for focused verified 18+ Yoti accounts and Stripe one-time USD 5 site-wide ad removal. Older paused-backend statements above are superseded for this focused task. Frontend owns portfolio UI/ad gating; Backend owns authentication, verification, persistence and payments. The proposed endpoint below is pending reconciliation with Backend GET `/api/account/current`; it is not an implemented live API.

Owner supplied public publisher identifier `ca-pub-6772183071188886`, account meta tag and seller line `google.com, pub-6772183071188886, DIRECT, f08c47fec0942fa0`. Local configuration records the real publisher ID but remains disabled, with manual unit ID null. No unconditional ad script is installed. `ads.txt` is a locally staged root candidate only, not published. Actual manual display unit IDs, site review, certified consent integration, confirmed purchase terms and explicit publication/activation remain prerequisites. Auto ads must remain off; no dashboard setting was changed.
