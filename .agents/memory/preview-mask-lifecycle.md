---
name: Preview mask lifecycle
description: Why retained photos must rehydrate masks during live preview updates.
---

Treat photo and floor-mask readiness as one lifecycle, including during live module updates. Renderer-only caches are not evidence that a retained room photo has a usable mask.

**Why:** Repeated visual fixes looked correct in fresh screenshots, but the user's already-open preview logged missing-mask errors during hot updates. React retained photo state while renderer module caches were replaced. This made fresh captures insufficient to validate the user's live session.

**How to apply:** Keep the loaded mask recoverable alongside its photo, restore caches before drawing, and reload both when asset versions change. Check the user's browser logs as well as fresh screenshot logs after renderer changes.

Use content-addressed mask filenames and publish their manifest only after all uploads finish; do not version mutable files with manually changed query strings.

**Why:** Changing a query version before uploading let an already-open browser cache old bytes under the new address for an hour. Fresh screenshot sessions then showed the correction while the user's screenshots still showed the previous boundaries.

**How to apply:** Keep asset publication ordered as build, upload immutable bytes, then publish references. Verify served file hashes, not just successful requests, and compare the user's annotated regions with the currently served mask before making more contour changes.
