---
name: byok-key-column-coupling
description: BYOK encrypted key column/format coupling that broke saving + generation
metadata:
  type: project
---

BYOK stores the user's encrypted API key in `public.user_settings.api_key_enc` as a **base64-encoded TEXT** value. `upsert_encrypted_api_key` must write `encode(v_encrypted, 'base64')` into `api_key_enc`, and `get_decrypted_api_key()` reads it back with `decode(api_key_enc, 'base64')`. These two RPCs are tightly coupled on both the **column name** and the **base64 format**.

The whole chain otherwise: frontend never sees the raw key (returns sentinel `USER_KEY_STORED_SERVERSIDE`), forwards the user JWT, and `callAIGatewayOnce` in `supabase/functions/_shared/promptHelpers.ts` decrypts server-side via `get_decrypted_api_key` RPC at generation time.

**Why:** Migration `20260624000000_free_byok_quota_update.sql` (free BYOK + quota bump) redefined `upsert_encrypted_api_key` to write a raw BYTEA into a non-existent `encrypted_api_key` column. Saving a key then 500'd ("column does not exist") and BYOK generation broke. Fixed 2026-06-24 to write `api_key_enc` as base64; user applied it via the Supabase SQL editor.

**How to apply:** When editing either RPC, change both together and keep the encode/decode + `api_key_enc` column consistent. `delete-api-key` edge function also nulls `api_key_enc`. Consider a round-trip assertion in the migration to catch desync. See [[byok-key-column-coupling]] sibling work if a regression guard is added.
