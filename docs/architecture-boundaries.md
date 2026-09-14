# Master Architecture Boundary Checklist

| Subsystem | Requirement | Enforcement Mechanism |
| :--- | :--- | :--- |
| Worker Boundary | Strictly local, version-coupled bundle | postinstall script + nonce-based CSP (connect-src 'self') |
| Text Ingestion | Full-width band bypass + dynamic x-gutter clustering | Coordinate histogramming on ?y line bands |
| Scanned Docs | Zero garbage text or blank items saved | < 50 char/page density check + summary skip report |
| Deduplication | Tier 1 (Hash), Tier 2 (Jaccard ? [0.82, 1.0)), Tier 3 (Review queue ? [0.60, 0.82)) | Tag-stripped lexical similarity + manual merge UI |
| Typst AST Anchors | Immune to keystroke corruption and offset drift | Render-time RF_BULLET injection + atomic editor decorations |
| Patch Validation | Zero metric hallucination or embellishment | Verbatim token matching + derived delta verification (±1pp tolerance) |
| Patch Generation | Offline-capable fix application | Client-side deterministic assembly from Evidence Bank (§11) |
| Persistence | Zero auth walls for guests; zero dropped work on login | IndexedDB fallback + sync-on-auth dedup migration |
| Memory Lifecycle | Prevent browser tab OOM on 100-file batches | Capped worker pool (|| 4 fallback) + worker recreation every 25 files |
| Airgap Verification | Regression-tested local-first proof | Production-build Playwright context.setOffline(true) suite (§12) |
