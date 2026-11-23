import { describe, it, expect } from "vitest";
import { resolveDraftConflict } from "../draftConflict";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const opts = { now: NOW, maxAgeMs: 24 * HOUR };

const draft = (savedAt: number, data: unknown) => ({ savedAt, data });

describe("resolveDraftConflict", () => {
  it("returns none when there are no drafts", () => {
    const r = resolveDraftConflict(null, null, opts);
    expect(r.kind).toBe("none");
    expect(r.expired).toEqual({ local: false, server: false });
  });

  it("returns the only side that exists", () => {
    const local = draft(NOW - HOUR, { step: 2 });
    expect(resolveDraftConflict(local, null, opts)).toMatchObject({ kind: "use-local", local });
    const server = draft(NOW - HOUR, { step: 3 });
    expect(resolveDraftConflict(null, server, opts)).toMatchObject({ kind: "use-server", server });
  });

  it("returns none when both sides hold identical data, ignoring key order and snapshot savedAt", () => {
    const local = draft(NOW - 2 * HOUR, { savedAt: 1, step: 2, form: { a: 1, b: [1, 2] } });
    const server = draft(NOW - HOUR, { form: { b: [1, 2], a: 1 }, step: 2, savedAt: 2 });
    const r = resolveDraftConflict(local, server, opts);
    expect(r.kind).toBe("none");
    expect(r.identical).toBe(true);
  });

  it("asks when both sides exist and differ", () => {
    const local = draft(NOW - 2 * HOUR, { step: 2 });
    const server = draft(NOW - HOUR, { step: 3 });
    const r = resolveDraftConflict(local, server, opts);
    expect(r.kind).toBe("ask");
    expect(r.local).toBe(local);
    expect(r.server).toBe(server);
  });

  it("ignores expired drafts and reports them", () => {
    const old = draft(NOW - 25 * HOUR, { step: 2 });
    const fresh = draft(NOW - HOUR, { step: 3 });
    expect(resolveDraftConflict(old, null, opts)).toMatchObject({
      kind: "none",
      expired: { local: true, server: false },
    });
    expect(resolveDraftConflict(old, fresh, opts)).toMatchObject({
      kind: "use-server",
      expired: { local: true, server: false },
    });
    expect(resolveDraftConflict(fresh, old, opts)).toMatchObject({
      kind: "use-local",
      expired: { local: false, server: true },
    });
  });
});
