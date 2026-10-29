# Local chat history and transport experiments

Nothing here is mounted in the application or deployed. The existing Worker,
Room/Lobby/Guard bindings, account routes and game assets are unchanged.

`history.mjs` uses the local `schema.sql` D1-shaped repository. The log has no
automatic message expiry. Refresh reads authoritative, deletion-filtered pages;
older pages share an exclusive cursor and fixed sequence fence. Tests retrieve
102 messages, including maximum emoji payloads, and close/reopen a SQLite file.
The deletion resolver defaults to deny; its test resolver is synthetic, not an
owner account grant. This schema has not been applied to a remote database.

`delivery.mjs` is a **Node ws-only** buffer adapter. An actual workerd
WebSocketPair probe establishes that its accepted server socket has no
`bufferedAmount`. It cannot be used as the Workers adapter.

`receipt-delivery.mjs` instead experiments with one unreceipted envelope at a
time and a 16 KiB combined pending/in-flight encoded budget. Each envelope is
limited to 12 KiB including its wrapper:

```json
{"type":"delivery","deliveryId":"server-generated-UUID","frame":{"type":"history"}}
```

The client decodes the full envelope before returning the exact receipt:

```json
{"type":"received","deliveryId":"same-server-generated-UUID"}
```

A receipt only advances transport flow. It is never a successful message-send
ack, account authorization or proof the user displayed/read the message. A
missing receipt for five seconds closes 1013. Wrong/stale receipts cannot advance
the queue. This bounds the application's outstanding envelopes; Workers exposes
no native buffer measurement, so no claim of directly measuring its internal
buffer is made. Malicious peers and aggregate room rates still need admission
and action limits in the real adapter.

This envelope is an **experimental protocol amendment**, not silently compatible
with the frozen V1 decoder. Frontend negotiation/integration remains required.
`transport-fixture.mjs` is only a test entry point with a temporary CHAT_ROOM
Durable Object: ordinary Worker requests cannot send to each other's owned
sockets. The fixture has synthetic signed-out identities and an exact fixture
Origin; it has NO production session-cookie admission, signed-in pending-account
gate, nickname/rate/idle-policy implementation, or real moderator authorization.
It must never be exposed as the production chat endpoint.

Run from the workspace root with the existing Node/toolchain:

```powershell
node prototypes/guest-chat/history.test.mjs
node prototypes/guest-chat/delivery.test.mjs
node prototypes/guest-chat/receipt-delivery.test.mjs
node prototypes/guest-chat/runtime-socket.test.mjs
node prototypes/guest-chat/transport.test.mjs
```

The last two require an isolated local workerd socket. The transport test uses
actual local D1 and two WebSocket clients, verifies history/broadcast/duplicate
request/forged role field/reconnect/append ordering, and closes a real client
that withholds receipts. Its database and runtime are disposed after testing.
It does not establish cross-network multiplayer, browser UI integration, a D1
process-restart guarantee, production recovery, or owner moderation capability.
