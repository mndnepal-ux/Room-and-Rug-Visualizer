# Room Studio

A browser-based rug-in-room visualizer inspired by MyRoom Studio, with original furnished scenes, textile designs, custom uploads, placement controls, local saves, and PNG export.

## Run & Operate

- Primary managed workflow: `artifacts/room-studio: web`
- `pnpm --filter @workspace/room-studio run typecheck` — check the visualizer
- `pnpm --filter @workspace/api-server run dev` — optional shared API server; not needed by the visualizer
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No database, secrets, or external rendering service is required by the visualizer.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/room-studio/` — visualizer application and original scene assets.
- `docs/reference-research.md` — reference-site findings, sources, and research limitations.

## Architecture decisions

- Use independently created imagery and rendering logic, not MyRoom Studio's proprietary assets or Explorug backend. **Why:** the reference was supplied for research and product inspiration, not as an authorized third-party rendering integration.
- Describe the photographic perspective preview accurately, not as a fully interactive 3D room. **Why:** floor projection on a photograph cannot supply arbitrary viewpoints or furniture occlusion.
- Keep this initial product browser-local. **Why:** its agreed workflow requires visualization, uploads and export, not accounts or cloud collaboration.

## Product

Four furnished scenes, an original searchable/filterable rug collection, custom image uploads, size/position/rotation controls, direct dragging, room/close-up/plan views, before/after, fullscreen, local saved designs, shareable catalogue configurations, and PNG downloads.

## User preferences

The user requested deep research of https://myroom.studio/ and a room visualizer based on that workflow.

## Gotchas

Uploaded rug images stay in the browser; shared links cannot transfer those images to another device. A photograph does not provide real-world measurement calibration or furniture occlusion.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
