import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueue,
  list,
  count,
  remove,
  markFailed,
  flush,
  isOfflineQueueEnabled,
} from "../pdvOutbox";

const STORE = "store-abc";

function seed(n: number) {
  for (let i = 0; i < n; i++) {
    enqueue({
      client_uuid: `u-${i}`,
      store_id: STORE,
      payload: { i },
    });
  }
}

describe("pdvOutbox", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("começa vazio para uma loja nova", () => {
    expect(list(STORE)).toEqual([]);
    expect(count(STORE)).toBe(0);
  });

  it("enqueue adiciona entradas e count reflete", () => {
    seed(3);
    expect(count(STORE)).toBe(3);
    const items = list(STORE);
    expect(items[0].client_uuid).toBe("u-0");
    expect(items[0].attempts).toBe(0);
    expect(typeof items[0].created_at).toBe("number");
  });

  it("remove apaga só a entrada certa", () => {
    seed(3);
    remove(STORE, "u-1");
    const uuids = list(STORE).map((e) => e.client_uuid);
    expect(uuids).toEqual(["u-0", "u-2"]);
  });

  it("markFailed incrementa attempts e guarda last_error", () => {
    seed(1);
    markFailed(STORE, "u-0", "boom");
    markFailed(STORE, "u-0", "boom2");
    const entry = list(STORE)[0];
    expect(entry.attempts).toBe(2);
    expect(entry.last_error).toBe("boom2");
  });

  it("respeita o limite MAX_ENTRIES=200", () => {
    seed(200);
    const overflowed = enqueue({
      client_uuid: "extra",
      store_id: STORE,
      payload: {},
    });
    expect(overflowed).toBe(false);
    expect(count(STORE)).toBe(200);
  });

  it("isola por store_id", () => {
    seed(2);
    enqueue({ client_uuid: "x", store_id: "other", payload: {} });
    expect(count(STORE)).toBe(2);
    expect(count("other")).toBe(1);
  });

  it("flush remove entradas em sucesso e mantém as falhas", async () => {
    seed(3);
    const rpc = vi.fn(async (payload: any) =>
      payload.i === 1 ? { ok: false, error: "nope" } : { ok: true },
    );
    const res = await flush(STORE, rpc);
    expect(res.sent).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.errors).toContain("nope");
    const remaining = list(STORE);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].client_uuid).toBe("u-1");
    expect(remaining[0].attempts).toBe(1);
  });

  it("flush captura exceções do callRpc como falha", async () => {
    seed(1);
    const rpc = vi.fn(async () => {
      throw new Error("network");
    });
    const res = await flush(STORE, rpc);
    expect(res.failed).toBe(1);
    expect(res.errors).toContain("network");
    expect(list(STORE)[0].last_error).toBe("network");
  });

  it("safeParse tolera JSON corrompido no storage", () => {
    localStorage.setItem(`pdv_outbox_v1:${STORE}`, "{not json");
    expect(list(STORE)).toEqual([]);
    expect(count(STORE)).toBe(0);
  });

  it("isOfflineQueueEnabled default true, respeita flag=false", () => {
    expect(isOfflineQueueEnabled()).toBe(true);
    localStorage.setItem("pdv_offline_queue_enabled", "false");
    expect(isOfflineQueueEnabled()).toBe(false);
    localStorage.setItem("pdv_offline_queue_enabled", "true");
    expect(isOfflineQueueEnabled()).toBe(true);
  });
});