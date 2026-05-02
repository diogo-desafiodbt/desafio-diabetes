/* PWA mínimo — ativa instalação e atualização; conteúdo continua em rede. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
