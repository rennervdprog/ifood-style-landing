import { beforeEach, describe, expect, it } from "vitest";
import { getCachedStoreBootstrap, invalidateCachedStoreBootstrap } from "../storeBootstrap";

const cache = (slug: string, storeId: string) => {
  sessionStorage.setItem(
    `store-bootstrap:${slug}`,
    JSON.stringify({
      cachedAt: Date.now(),
      data: {
        store: { id: storeId },
        hours: [],
        sections: [],
        products: [],
        owner_profile: null,
        online_drivers_count: 0,
      },
    }),
  );
};

describe("cache de bootstrap da loja", () => {
  beforeEach(() => sessionStorage.clear());

  it("recupera um catálogo recente da sessão", () => {
    cache("mercado-central", "store-1");

    expect(getCachedStoreBootstrap("mercado-central")?.data.store?.id).toBe("store-1");
  });

  it("remove apenas o catálogo alterado por evento em tempo real", () => {
    cache("mercado-central", "store-1");
    cache("padaria-bairro", "store-2");

    invalidateCachedStoreBootstrap("store-1");

    expect(getCachedStoreBootstrap("mercado-central")).toBeNull();
    expect(getCachedStoreBootstrap("padaria-bairro")?.data.store?.id).toBe("store-2");
  });
});
