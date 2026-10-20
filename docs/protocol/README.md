# Protocol docs

| Document | What it covers |
|---|---|
| [PROTOCOL.md](PROTOCOL.md) | Wire protocol v1: inbound pipeline, HTTP, client/server messages, error and close codes, RoomConfig, RoomView and the projection rule, lifecycle, adapter contract, link fragments, presets, Phase 2 reserved items |
| [TESTIDS.md](TESTIDS.md) | `data-testid` contract between the web app and the e2e tests (planned by A3 with A5; not written yet) |
| [../adr/README.md](../adr/README.md) | Architecture decision records |

Source of truth for every shape is `packages/core/src/schemas.ts` (plus `preset.ts`, `links.ts`,
`e2ee.ts`, `auth-provider.ts`). If a document and the code disagree, the code wins and the
document is a bug.
