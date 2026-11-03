# Room Studio

A browser-based rug-in-room visualizer inspired by MyRoom Studio, with supplied room photographs, textile designs, custom uploads, placement controls, local saves, and PNG export.

## Run & Operate

- Primary managed workflow: `artifacts/room-studio: web`
- `pnpm --filter @workspace/room-studio run typecheck` — check the visualizer
- `artifacts/api-server: API Server` — required for serving the imported MND catalogue images from App Storage
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No database or external rendering service is required. App Storage is used for optimized public MND design images and supplied room photographs; its environment is provisioned by the storage setup.

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
- `scripts/src/import-mnd-catalog.ts` — import and optimize the public MND collection into App Storage.
- `scripts/src/import-room-photos.ts` — optimize and store the supplied room photographs in App Storage.
- `scripts/src/build-floor-masks.ts` — build photo-aligned floor alpha masks; review full-floor diagnostics before uploading with `--upload`. Python/OpenCV is only used during asset preparation.

## Architecture decisions

- Use independently created imagery and rendering logic, not MyRoom Studio's proprietary assets or Explorug backend. **Why:** the reference was supplied for research and product inspiration, not as an authorized third-party rendering integration.
- Describe the photographic perspective preview accurately, not as a fully interactive 3D room. **Why:** floor projection on a photograph cannot supply arbitrary viewpoints; furniture visibility uses masks traced for each original scene.
- Keep this initial product browser-local. **Why:** its agreed workflow requires visualization, uploads and export, not accounts or cloud collaboration.

## Product

Five supplied room scenes, all 81 MND Nepal designs from collection pages 1–5, compatible original sample designs, search and pagination, custom image uploads, size/position/rotation controls, direct dragging, room/close-up/plan views, before/after, full screen with an explicit exit and an expanded-view fallback, local saved designs, shareable catalogue configurations, and PNG downloads.

## User preferences

The user requested deep research of https://myroom.studio/ and a room visualizer based on that workflow.
The user requested all rug designs from pages 1–5 of https://modernnaturedesignnepal.com/collections, using the actual design images and original names.
The user requested a single room named Bedroom, removing the duplicate, and one Lobby. The five rooms are Living Room, Bedroom, Lobby, Kitchen, and Office. Floor masking corrections must apply to every room.

## Gotchas

Uploaded rug images stay in the browser; shared links cannot transfer those images to another device. A photograph does not provide real-world measurement calibration. Replacing a room photograph requires rebuilding and reviewing its photo-aligned floor alpha mask, including thin legs and open floor beneath furniture. The same alpha mask is used for compositing and hit testing.
MND catalogue size defaults are adjustable preview dimensions inferred from image proportions, not verified product measurements. Catalogue images are served through the API at the same origin to preserve PNG export without canvas CORS restrictions.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
