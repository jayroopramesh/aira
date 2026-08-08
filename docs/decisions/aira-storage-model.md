# Captain instruction: storage model — a real user-owned folder

**Captain's instruction (2026-08-08):** the vault should live in a folder the user creates on
their own device (Finder/Explorer on a computer, the Files app on a phone), so it persists as an
ordinary file the user owns. This is the captain's answer to the browser-eviction risk raised in
`data/aira-stack-s1/report.md` §4.3.

**Status:** accepted as the target model. It is fully deliverable on desktop Chromium and on a
native wrapper; it degrades on iOS Safari, which cannot bind a live folder handle. See the
platform note below.

## What the platform actually allows

| Platform | Real user-owned folder? | Mechanism |
|---|---|---|
| Chrome / Edge desktop | **Yes, exactly as described** | File System Access API — a persisted directory handle; the app reads/writes real files in the user's chosen folder, immune to browser eviction |
| Safari / Firefox desktop | No live handle | Manual export/import through the file picker only |
| iOS Safari (incl. installed PWA) | **No live handle** | Share-sheet export to Files and file-picker import; the working copy still lives in browser storage |
| Android Chrome | Needs verification | File System Access support on Chrome for Android must be confirmed empirically, not assumed |
| Native wrapper (Capacitor) | **Yes on every platform** | App sandbox + a Files-visible document directory |

## Engineering consequence (binding)

The vault must sit behind a single storage-adapter interface with the encrypted single-file
export as the canonical source of truth. Required adapters:

1. **Directory-handle adapter** — File System Access, the preferred path where available.
2. **Managed-storage adapter** — OPFS/IndexedDB working copy plus explicit export/import, the
   fallback on Safari and iOS. Must call `navigator.storage.persist()`.
3. **Native-filesystem adapter** — added only if and when a native wrapper ships.

No application code may talk to a storage API directly. This is what keeps the captain's folder
model, the iOS fallback, and any future native build from becoming three different products.
