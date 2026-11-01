import { describe, it, expect } from "vitest";
import { ENTREGADOR_APP } from "../entregadorApp";

describe("ENTREGADOR_APP (página /download)", () => {
  it("versão em formato x.y.z", () => {
    expect(ENTREGADOR_APP.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("o arquivo do APK carrega a mesma versão anunciada", () => {
    expect(ENTREGADOR_APP.apkPath).toBe(
      `/apps/itasuper-entregador-${ENTREGADOR_APP.version}.apk`
    );
  });

  it("tamanho e novidades preenchidos", () => {
    expect(ENTREGADOR_APP.sizeLabel.length).toBeGreaterThan(0);
    expect(ENTREGADOR_APP.whatsNew.length).toBeGreaterThan(0);
  });
});
