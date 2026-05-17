// Kill-switch SW: substitui qualquer SW antigo do vite-plugin-pwa,
// limpa todos os caches, força reload dos clients e se desregistra.
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.all(
          clients.map((c) => {
            try {
              const url = new URL(c.url);
              url.searchParams.set("sw-cleanup", Date.now().toString());
              return c.navigate(url.toString());
            } catch {
              return Promise.resolve();
            }
          })
        );
        await self.registration.unregister();
      } catch {}
    })()
  )
);
// Não intercepta fetch — deixa a rede passar direto.