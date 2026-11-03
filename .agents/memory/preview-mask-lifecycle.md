---
name: Preview mask lifecycle
description: Why retained photos must rehydrate masks during live preview updates.
---

Treat photo and floor-mask readiness as one lifecycle, including during live module updates. Renderer-only caches are not evidence that a retained room photo has a usable mask.

**Why:** Repeated visual fixes looked correct in fresh screenshots, but the user's already-open preview logged missing-mask errors during hot updates. React retained photo state while renderer module caches were replaced. This made fresh captures insufficient to validate the user's live session.

**How to apply:** Keep the loaded mask recoverable alongside its photo, restore caches before drawing, and reload both when asset versions change. Check the user's browser logs as well as fresh screenshot logs after renderer changes.
