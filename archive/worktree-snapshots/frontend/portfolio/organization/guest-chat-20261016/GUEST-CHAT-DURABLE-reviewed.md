# Guest chat V1 — frozen local integration draft

## Owner supersession: durable growing log, 2026-10-16

The owner explicitly requires one persistent growing log, visible after refresh
and restart, appending until they delete messages. This section SUPERSEDES every
15minute/100total/in-memory-transcript statement below. Older text remains draft
history, not the active retention policy.100 is a client view/cache window only;
there is no automatic transcript age expiry. Persistent storage has operational
cost/abuse/privacy implications; no remote provisioning is authorized here.

Durable roomEpoch is stored with the log and survives process restart; global
event seq is an increasing database integer, shared by append and delete events.
Owner deletion erases original text and author data; retains only a minimal
messageId/event-cursor tombstone for ordered synchronization. A cleared viewport
is never a database deletion. Guest display IDs/opaque incarnation IDs in stored
messages remain historical labels, not active identity or authorization.

Refresh/reconnect discards browser cached transcript and reloads an authoritative
latest page, then supports Load older. Server captures throughSeq and returns
at most8messages per page, oldest-to-newest WITHIN that page; pages walk backward
using olderBefore. Example history frame (new durable draft shape):

```json
{"type":"history","roomEpoch":"opaque","throughSeq":102,"messages":[],"olderBefore":94,"complete":true}
```

`complete:true` ends that bounded page, NOT the entire permanent log. Numeric
olderBefore is a strict exclusive seq cursor; null means no older non-deleted
messages remain. All cursors are nonnegative safe integers, olderBefore when
non-null is positive. Client prepends older pages in order, dedups by messageId,
and may evict offscreen DOM/cache without deleting server data. No offset-based
pagination: concurrent appends/deletes must not reorder or skip retained records.

Client asks for an older page, with exact fields:

```json
{"type":"history_before","requestId":"older1","throughSeq":102,"beforeSeq":94}
```

Server replies with one history frame plus ack for that request. Initial latest
page has no requestId; requested history frame additionally carries requestId.
No 100-message-total cap. Server12KiB frame/client2048bytes/16KiB queue bounds
remain. history.throughSeq is fixed for an older-page chain; newer live events
arrive only after the initial page complete, in seq order, dedup by messageId.
Live events during an older-page query are buffered behind that page completion
under the same queue/drain bounds. A deletion after throughSeq may cause its
message to be absent from a later DB page; it must never be resurrected.

Refresh always gets current deletion-filtered DB pages, no arbitrary old-browser
cache or unbounded tombstone replay. Persistent missed-event recovery and actual
transport are still pending local implementation; the durable repository seam
exists under prototypes/guest-chat/history.mjs. Moderation deletion resolver
defaults to deny; current deletion tests inject a synthetic trusted resolver,
NOT an implemented owner-account grant. No actual role or chat deployment yet.

The historical history frame below lacks olderBefore and must not be used as
the durable decoder schema. Use this supersession's fields. Existing guest/mod
authorization, plain text, incarnation and owner-exemption requirements remain.

2026-10-16. This is the frontend/backend interface for the next isolated local
prototype, not a deployed route, new binding or implemented moderator grant.
One general browser-WebSocket room; not federated IRC. Existing game Room,
Lobby and Guard protocols remain untouched. No DM, uploads or link previews.

## Admission and identity

Proposed same-origin paths: POST `/api/chat/session` with JSON `{}` and exact
Origin creates a short-lived server session cookie; GET `/api/chat/ws` upgrades
using that HttpOnly host cookie and exact Origin. No credential in query strings
or public frames. Account cookies remain separate. Signed-out guests are the
owner's explicit exception to account verification. A signed-in pending/suspended
account cannot obtain guest admission to bypass the blocking onboarding screen;
account-store failure with an account cookie fails closed. Account suspension
also blocks any moderator exception. Guest is visibly unverified, never18+ proof.

The server assigns a unique active five-digit display `guestId` (10000–99999)
with cryptographic random selection, bounded retries and capacity refusal rather
than duplicate IDs. It also assigns opaque `participantId` per connection
incarnation. Display ID is neither a secret nor an authorization/mute target.
Reconnect requires a new admission, new participantId and new display ID; no
resume or offline message queue in V1. Cookie retention/ban semantics belong to
the server session, not the reused display ID. Clearing cookies can evade guest
bans; no permanent fingerprint or claimed ban-proof identity is introduced.

Render each accepted message as distinct text nodes:
`guest@12345 | [nickname]: [message]`. ID/role/badge/color are server-assigned;
nickname/text must never be interpreted as HTML or system/moderator content.
Exact reserved owner nickname `Alexander Banderov` is assigned only to an
authenticated server-authorized moderator, with gold name and visible Moderator
label. No public account email, IP, location or private role-bootstrap identifier.

## Frames

JSON text only, object with exact keys for its type. Client frames maximum2048
UTF8bytes; server frames maximum12KiB. History arrives in bounded batches of at
most8messages, ending with complete:true; welcome resets the client's history.
Do not concatenate100messages into a frame or queue all batches at once: pace
initial history behind the16KiB output bound, with a5second drain deadline.
Opaque roomEpoch/participantId/messageId strings match
`^[A-Za-z0-9_-]{1,64}$`; production candidates generate random UUIDs, never
emails/IPs. Event seq is a positive safe integer; sentAt is a nonnegative safe
integer in Unix milliseconds. history.throughSeq is a nonnegative safe integer.
Reject unknown fields, invalid numbers and oversized opaque strings before UI
retention. Do not assume contiguous message seq: deleted/expired entries leave
gaps. Overflow of a sequence counter requires a new room epoch, never wrapping.
Server sequence `seq` is increasing within `roomEpoch`; a new epoch resets it.
Client `requestId` is unique ASCII `[A-Za-z0-9_-]{1,32}`. Server deduplicates the
last64requests for that participant for up to120seconds; reconnect resets this
cache, not server bans. Clients never assign guestId/participantId/role/sequence.

Server greeting, followed immediately by history:

```json
{"type":"welcome","version":1,"roomEpoch":"opaque","self":{"participantId":"opaque","guestId":"12345","nickname":"Guest","role":"guest"},"capabilities":{"moderate":false,"freshAuthRequired":false},"limits":{"nicknameCodePoints":24,"messageCodePoints":280,"historyMessages":100,"frameBytes":2048}}
```

```json
{"type":"history","roomEpoch":"opaque","throughSeq":0,"messages":[],"complete":true}
```

An item in history has exactly the same shape as a live `message`:

```json
{"type":"message","roomEpoch":"opaque","seq":1,"messageId":"opaque","sentAt":1792190000000,"author":{"participantId":"opaque","guestId":"12345","nickname":"Guest","role":"guest"},"text":"Hello"}
```

Clients send only these ordinary actions:

```json
{"type":"say","requestId":"r1","text":"Hello"}
```

```json
{"type":"nick","requestId":"r2","nickname":"New nickname"}
```

```json
{"type":"ping","requestId":"r3"}
```

Server replies once per accepted request; retries receive the same ack without
another broadcast, ID allocation or moderation effect:

```json
{"type":"ack","requestId":"r1","messageId":"opaque"}
```

Nick ack contains `self` with the full updated server-authoritative identity;
participantId/guestId/role stay unchanged. Ping/moderation/leave ack has only
type/requestId. Nick changes affect future messages only.

History/live fence: capture at most100history references at throughSeq when
welcome is emitted. Every batch repeats that same throughSeq and is sorted by
original message seq. No live message/deleted event is delivered to that client
until its complete:true history batch. Hold later events (seq>throughSeq) in
order behind a combined16KiB encoded-output budget, including transport queued
bytes and the current history batch. History references are bounded100/client;
do not pre-encode or queue all history. Overflow or5s drain timeout closes1013
rather than silently dropping/reordering. Client accumulates all history batches
after welcome, then applies live events; messageId dedup protects duplicates.
`deleted.seq` is a NEW globally increasing event cursor, not the target message's
old seq; messageId identifies the original message to remove. Any delete after
the fence waits behind complete and therefore cannot race history restoration.

```json
{"type":"error","requestId":"r4","code":"rate_limited","retryAfterSeconds":2}
```

Other bounded codes: `invalid_frame`, `invalid_text`, `reserved_name`,
`room_full`, `muted`, `banned`, `forbidden`, `fresh_auth_required`,
`account_verification_required`, `service_unavailable`. Never echo malformed
payloads, account existence, private email/IP or provider errors. requestId is
omitted when invalid/unavailable. retryAfterSeconds only for timed refusal.

Explicit client `{type:"leave",requestId}` gets ack, then close1000. Server
shutdown/service fault1011, overload1013, policy violation1008, oversized1009,
binary1003. Close reasons are generic. A disconnected UI keeps its draft but
never automatically resends it or claims that an unacknowledged send succeeded.

## Bounds, history and moderation

Adopt24Unicode-code-point nickname,280-code-point message,100history messages
for this draft. Reject blank text, multiline/C0/C1 and explicit bidi override/
isolate controls; preserve ordinary multilingual letters and emoji/ZWJ. Reserved
moderator/system names are case/whitespace normalized before refusal. Render
plain text; fake prefix text in a message never replaces the authoritative author.
The prototype must test confusable/reserved-name handling before claiming it.

At most50connections,10minute idle timeout (ping refreshes),20second ping target;
three say/nick actions per10seconds per guest, maximum280accepted messages per
minute for the general room. Slow-mode policy may tighten, never relax ceilings.
Use bounded output queue16KiB per connection; close slow readers instead of
unbounded buffering. Local history expires after15minutes, capped100entries;
no durable transcript, permanent browser fingerprint or account/IP in history.
No public roster is required. In-memory sessions/history/moderation are lost on
prototype restart; persistent service policy must be reviewed before deployment.

Local mute uses opaque participantId, not the five digits. Server moderation
actions are `delete` by messageId; `mute`, `kick`, `tempban` by participantId;
`slowmode` by intervalSeconds. Muting/tempban/slowmode TTL30–900seconds,
slow interval1–30seconds. Resolve the active participant/session incarnation on
the server; stale target returns a generic refusal, never targets a new guest
who reused the display ID. tempban applies to that server guest-session cookie,
not innocent later users or shared IP. delete broadcasts a bounded tombstone
`{type:"deleted",roomEpoch,seq,messageId}` and removes text from history.

```json
{"type":"moderate","requestId":"m1","action":"mute","participantId":"opaque","durationSeconds":60}
```

No guest can self-claim moderation through nickname, email, frame, role flag or
account ID. Every action rechecks server role, account suspension/revocation and
fresh authentication (15minute ceiling for sensitive moderation). Successful
magic-link email proof alone does not grant a role. Owner-designated bootstrap
must bind a verified exact private owner email to stable accountId plus account
creation identity in a reviewed private role record. No email-change/recycled-ID
auto-promotion; role revocation invalidates capabilities. No embedded master key.
Implementation/assignment remains local and separately tested, not live granted.

Moderator onboarding/ad-removal exemptions are explicit capabilities, never
fabricated age/identity proof or a paid transaction. They do not bypass session,
CSRF, Origin, suspension, freshness, message limits or abuse controls. Account
current/gate additions need a separately reviewed schema before frontend uses
them; welcome role/capabilities are only chat presentation, not account authority.
Private bounded audit metadata records action/actor/target IDs/time/TTL, never
message contents, IP or email. Prototype audit cap1000events/24hours, memory only;
no staff availability or report response is promised. Reporting/admin UI stays
unavailable until an authenticated server path is actually implemented.

## Required local acceptance

Two actual local WS clients exchange welcome/history/message/ack and explicit
leave; duplicate request does not double-send. Seed ID collision/retry/exhaustion,
forged identity/mod command, nickname/control/bidi/multiline spoof, size/rate and
queue overflow, idle/reconnect/history expiry and stale-incarnation mute/delete.
Moderator fixtures prove anonymous/other-account denial, stable verified owner
grant, revocation/suspension/logout/freshness and exemption without false paid/
age flags. Pending signed-in guest bypass must fail. Frontend mock tests are not
proof of these server/runtime invariants. No production mutation or deployment
is authorized by this draft.
