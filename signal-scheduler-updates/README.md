# Signal Scheduler update channel

This folder is the stable update channel for the user's Signal Scheduler Web server.

- `manifest.json` tells installed servers which build is current.
- Update payloads are published as encrypted `.ssu` envelopes.
- The public key in `update_public.pem` is used to encrypt future payloads.
- The matching private key is kept only in the user's V8.1.0 installer/VPS and must never be committed here.
- Normal updates may replace only `app/` files and restart the scheduler container; Signal worker volumes must not be removed or recreated.
- Before publishing a future update, build the encrypted payload, upload it under this folder, compute SHA256, then update `manifest.json` last.
