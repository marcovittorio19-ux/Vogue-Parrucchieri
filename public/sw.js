self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};

  const title = data.title || "Vogue Parrucchieri";

  const options = {
    body: data.body || "Nuova notifica",
    icon: "/logo.png",
    badge: "/logo.png",
    data: {
      // Se non arriva un url dalla funzione Supabase,
      // apre sempre la homepage completa
      url: data.url || "https://vogue-parrucchieri.vercel.app/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const urlToOpen =
    event.notification.data.url ||
    "https://vogue-parrucchieri.vercel.app/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
