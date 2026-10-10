/* sw.js — service worker for goal-linked reminders (spec task 10).
 *
 * WHAT THIS IS (and isn't)
 * v1 uses LOCALLY-SCHEDULED notifications, not server-sent Web Push. There is
 * no VAPID key, no subscription, no server state, and no learner data ever
 * leaves the device (Requirement 7.2). The page composes the copy from local
 * data and posts it here; this worker just shows it and handles the click.
 *
 * HONEST LIMITATION (Requirement 5.6): because there is no push service, this
 * cannot wake a fully-closed browser the way server push can. The in-app
 * banner (Requirement 4) is the always-present fallback. This worker only
 * shows notifications while it is alive (page open / recently active).
 *
 * Dependency-free and defensive: every handler guards its inputs and never
 * throws in a way that would break the page.
 */

// Take control promptly so the first opt-in can use the worker without a reload.
self.addEventListener('install', () => {
  // No pre-caching: this worker exists only to show/route notifications.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* The page posts { type:'show-reminder', title, body, itemId } when a reminder
 * is due AND the item is still under the two-touch cap (the cap is enforced on
 * the page via the store's `touches`; this worker just renders what it's told).
 * `tag` de-dupes: re-posting the same itemId replaces the existing notification
 * rather than stacking a second one. */
self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data || data.type !== 'show-reminder') return;

  const title = typeof data.title === 'string' && data.title ? data.title : "Something's ready";
  const body = typeof data.body === 'string' ? data.body : '';
  const itemId = typeof data.itemId === 'string' ? data.itemId : '';

  if (!self.registration || typeof self.registration.showNotification !== 'function') {
    return; // Notifications unsupported in this worker context — nothing to do.
  }

  event.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        tag: itemId || 'reminder', // de-dupe per item
        data: { itemId },
        // No badge/icon assets are bundled with the prototype; keep it minimal.
        requireInteraction: false,
      })
      .catch(() => {
        // Showing can reject (e.g. permission revoked mid-session). Stay silent
        // and let the in-app banner remain the fallback.
      })
  );
});

/* Clicking a reminder should open the app "at the next thing". We append a
 * `#next` hash so the page can jump into the mission on load (it reads
 * location.hash). If a tab is already open we focus it and nudge it to the
 * next thing via postMessage; otherwise we open a new window. */
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  if (notification && typeof notification.close === 'function') {
    notification.close();
  }

  const itemId =
    notification && notification.data && typeof notification.data.itemId === 'string'
      ? notification.data.itemId
      : '';

  // The app URL with a hash the page understands ("jump to the next thing").
  const targetUrl = new URL('./weekend-mission-prototype.html#next', self.location.href).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // Reuse an already-open app tab: focus it and tell it to jump.
          if ('focus' in client) {
            try {
              client.postMessage({ type: 'open-next', itemId });
            } catch {
              // postMessage can fail on some clients; focusing is enough.
            }
            return client.focus();
          }
        }
        // No open tab: open a fresh one at the next thing.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
      .catch(() => {
        // Client enumeration/open can fail; fail quietly (in-app banner remains).
      })
  );
});
