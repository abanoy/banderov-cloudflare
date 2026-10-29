# Ad-block recovery: researched implementation proposal

Reviewed 2026-10-16. LOCAL ONLY. Current production baseline fdfff3fc-9c88-4c7a-bebd-e35be28c00c5,221assets. The live portfolio has runtime ads disabled and no manual slot ID. No AdSense message, provider tag, account setting, or deployed route was changed for this study.

## Recommendation and fidelity to the requested behavior

Use Google's supported AdSense recovery detection/message first, with **Centered modal (non-dismissible)** and a Custom Choice account route once an actual ad-free purchase is available. The owner wants the notice to remain until ads are allowed or server-confirmed paid access applies. Do not replace that with an ordinary close button. A client-side notice is a business rule, not tamper-proof authorization: users control their browsers; the original public assets remain public.

The local Banderov design explores an opaque, full-viewport page with a terminal window, explicit site-only allowance instructions, recheck, account, privacy and help. It has no close/X or “continue anyway.” It does not silently unblock on a button click. Google supplies a centered overlay, not a promise of this exact full-screen custom layout. Choose Google's supported appearance or separately review a custom shell driven by supported status callbacks; do not deploy both competing notices. A no-dismiss notice still needs usable essential routes and a genuine positive-state exit.

## Verified supported setup

[Google's message creation guide](https://support.google.com/adsense/answer/11576085?hl=en) documents a non-dismissible centered option, unavailable with the “Allow ads or dismiss” type. In AdSense: Privacy & messaging → Ad blocking recovery → Create message; select banderov.com, language, custom alternative if available, placement, branding, and save a draft. Review the Acceptable Ads decision before any first publication. Inclusions/exclusions are supported, with five entries total per domain; exclusions override inclusions. Use application-level route controls too. The actual dashboard and account eligibility were not inspected or changed.

[Tagging instructions](https://support.google.com/adsense/answer/11575177?hl=en): retrieve the exact code from Privacy & messaging → Ad blocking recovery → Tagging. The publisher ID or ads.txt alone is not this tag. It belongs in the head of eligible pages after authoritative eligibility is resolved. Even a draft message plus an installed tag collects detection/reporting data, so draft does not mean no tracking. Do not install it merely for this prototype.

[Custom Choice](https://support.google.com/adsense/answer/11576797?hl=en) provides a custom button URL and an existing-customer footer URL. The required controlled messaging function must prevent repeat messages for eligible users. Proposed future URLs are /account/ for existing paid users and an explicitly approved account purchase flow when actually enabled. Current identity/age/payment gates are OFF: no working “Pay $5 now” claim or fake checkout.

[Privacy & Messaging API](https://developers.google.com/funding-choices/fc-api-docs): define controlledMessagingFunction before Google scripts. Its proceed decision can suppress recovery; this alone still downloads the SDK. Our stricter paid rule is to resolve fresh server entitlement **before any ad/recovery SDK is loaded**, and skip both entirely for eligible paid game users. Use callbackQueue with AD_BLOCK_DATA_READY; supported statuses distinguish extension, network, none and unknown. A timeout is unknown. “Allow ads” interaction is not itself proof of disabled blocking; re-evaluate supported status. The API is client-controlled and cannot authorize purchases.

[Google's error-protection message](https://support.google.com/adsense/answer/11575480?hl=en) is a separate optional bottom-pinned English backup; it does not hide content. It is not the requested full-screen gate. Google also acknowledges messaging itself may be blocked. Do not pretend this tag guarantees enforcement.

## Approaches and limitations

| Approach | Useful for | Limits / recommendation |
| --- | --- | --- |
| Google recovery | Maintained integration and supported status/message APIs | Requires exact dashboard tag/message/configuration and eligibility. Can itself be blocked. Prefer this over an invented detector. |
| Custom DOM bait / failed script test | A weak observation that one element/resource is unavailable | Hiding, CSP, DNS, offline state, a slow connection, CSS or script failure can cause the same result. Never sufficient for a blocker accusation or mandatory gate. No such probes are implemented here. |
| uBlock Origin | Network and cosmetic filtering are distinct ([official explanation](https://github.com/gorhill/uBlock/wiki/Does-uBlock-Origin-block-ads-or-just-hide-them%3F)) | The site cannot enumerate installed extensions reliably. Filter lists/settings change; don't claim every uBlock version is detected. No filter-evasion or disguised endpoints. |
| Built-in browser protection | Brave Shields and Firefox tracking protection can affect resources without an extension | Give site-specific help, not “you installed an ad blocker” accusations. [Brave](https://support.brave.app/hc/en-us/articles/360022973471-What-is-Shields), [Firefox](https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop). |
| Network / DNS filtering | Can prevent ad hosts resolving regardless of browser extension state | A toolbar exception may not fix it. Avoid asking users to disable corporate security, antivirus, or router protection globally. Unknown failures remain unknown. |

A page cannot force an extension to cooperate or make public assets inaccessible. No obfuscation, renamed ad endpoints, CNAME disguises, fingerprinting, extension inventory, or persistent blocker profiles are proposed. No polling loop or ad refresh tied to rechecking. [uBlock's official popup guide](https://github.com/gorhill/uBlock/wiki/Quick-guide:-popup-user-interface) explains its per-site power control; link to it rather than copying browser-specific screenshots that can age.

## False-positive and privacy boundaries

[Google's unfilled-unit documentation](https://support.google.com/adsense/answer/10762946?hl=en) explicitly distinguishes successful requests that returned no creative. unfilled/unfill-optimized, zero revenue, a hidden slot, low inventory or no visible ad is not blocker evidence. Never gate merely because an ad did not fill. Consent absent/denied, CSP errors, network timeout, offline state, unconfigured publisher/slot, or missing SDK callback also do not establish a blocker.

Ad recovery is separate from consent. Do not turn “allow ads” into acceptance of personalized advertising or assume a non-dismissible wall satisfies consent requirements. [Google requires an appropriate certified CMP for relevant EEA/UK/Swiss traffic](https://support.google.com/adsense/answer/13554116?hl=en). Actual regional consent behavior and lawful deployment need review before enabling ads; no legal-compliance conclusion is claimed here. Keep privacy-choice entry points available. Do not suppress necessary consent messaging using an indiscriminate recovery suppression hook.

## Decision order and account boundaries

1. Essential account/sign-out/status/auth callback, privacy, help and recovery routes remain reachable with no ad/recovery scripts.
2. Existing signed-in pending identity/age onboarding takes priority; do not stack notices. Current live Worker remains authoritative for that gate. The prototype only simulates it.
3. Validate fresh V3 server account status and entitlement. A paid grant needs active account, identity proof, independent eligible_18plus, server siteGamesAdFree and all_site_games scope. No query/localStorage/click/return URL can grant it. Unknown/expired account status loads neither ad nor recovery SDK.
4. Confirm route and configured ads/consent eligibility. Exclude standalone NoAds builds, external-platform games, account HTML and raw game controls. This study is a future hosted-game wrapper, not a change to game builds. Paid all-site-games scope must not silently become a subscription or promise ad removal across unrelated external sites.
5. If eligible unpaid, only then load approved consent-aware scripts and obtain supported blocker status. Positive block status shows recovery. Unknown/error/no-fill shows a neutral diagnostic state, not a blocker verdict. Positive no-block or fresh paid status clears the recovery state. Do not store a permanent client “allowed” entitlement.

The full-screen page has ordinary document navigation, not a trapped modal. No Escape/X bypass, but keyboard users can always reach recheck, account/sign-out, privacy and help. In a future integration pause game input/audio before showing it and restore focus/scroll on successful exit; never cover running game controls with a clickable ad. No real support email or privacy-policy URL was invented. Current prototype help/privacy routes are local study content; production needs reviewed published destinations.

## Activation checklist — still outstanding

- Owner reviews this exact prototype and chooses supported Google appearance versus separately reviewed custom shell.
- AdSense site approval/readiness, exact recovery tag, actual manual slot IDs, draft message configuration and Acceptable Ads choice; dashboard not yet inspected. Never invent IDs.
- Approved ad placements and real creative/no-fill/loading/CLS checks, regional CMP/consent flow, published privacy/support destinations.
- Authoritative paid entitlement endpoint already has a contract, but actual independent eligibility/Identity/Checkout remain disabled. Do not advertise a currently purchasable bypass. Backend coordination is authorized; no new backend work required by this local study.
- Integration must resolve identity/onboarding and paid status before any SDK, protect callback CSP, preserve one Worker and all game pins/NoAds/external variants. Current source/config contain pending work; follow HOSTING and capture actual deployed modules/settings for any future authorized release.
- Test real installed uBlock Origin/uBO Lite, Brave Shields, Firefox protection, mobile Safari/content blockers, DNS filtering, offline/slow network, consent choices, status outage, account expiry, cross-tab changes, keyboard/zoom/screen reader and real paid bypass network traces. These real-provider/extension/device tests have NOT been run.
- Separate explicit owner authorization before publishing any recovery tag, enforcement, live ads or account/dashboard settings. Current local prototype performs no provider requests and sends no email.

## Actual local evidence

Canonical prototype: projects/portfolio/monetization/recovery/. Preview http://127.0.0.1:4197/ . Open Preview states, choose Future configured fixture and Apply. No real detector/Google SDK is installed; explicit provider-enum normalizer accepts only recognized extension/network-level blocking statuses, generic network/offline/error values stay unknown.29 pure policy cases +9 enum mapping cases passed. Four Chrome widths320/390/768/1280 each tested9states, stillblocked recheck retained, positiveclear exit, essential routes, paidbypass, pendingonboarding, expiredpaid, nofill/consent/unknown; no externalrequests or POST.320noJS/forcedcolors/reducedmotion passed. Additional320x568/390x700 normal+200percent CSSzoom fourcases pass; primary recheck within initial viewport at normal scale, keyboard essential routes reachable, no horizontal overflow. Actual desktop/phone captures viewed.

Failures retained: first focus assertion followed closing fixture controls, which stole focus; Apply now closes controls before focusing result heading and suite passed. First200percent CSSzoom found407px overflow at320; wrapped brand/control text and removed fixture-label minimum width, reran pass. Approval review timed out before a local-source save; retry initially referenced an unwritten helper (no writes), corrected. No real extension/provider/physical-device/browser-menu-zoom/spoken-screenreader/payment acceptance claimed.
