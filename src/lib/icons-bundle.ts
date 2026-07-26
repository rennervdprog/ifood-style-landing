/**
 * Bundle offline de ícones.
 * Gerado a partir de src/lib/icon-map.ts — importa localmente para funcionar
 * sem internet (APK). Importado uma vez em src/main.tsx.
 */
import { addCollection } from "@iconify/react";
import solar from "./icons/solar-subset.json";
import mdi from "./icons/mdi-subset.json";

addCollection(solar as any);
addCollection(mdi as any);
