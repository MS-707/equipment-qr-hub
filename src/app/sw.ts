/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Field crews go days without connectivity. Serwist's default page caches
// expire after 24h with no last-used extension and no network timeout — a
// weekend offline bricked the app shell, and flaky connections hung on the
// OS-level fetch failure instead of falling back to cache. These entries
// shadow the default page caches (same names, matched first) with 30-day
// last-used expiry and a 4s network timeout.
const PAGE_TTL_SECONDS = 30 * 24 * 60 * 60;

const pageCachePlugins = () => [
  new ExpirationPlugin({
    maxEntries: 64,
    maxAgeSeconds: PAGE_TTL_SECONDS,
    maxAgeFrom: "last-used",
  }),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // NO auto-skip-waiting: updates wait for the user to tap the SwUpdateBanner
  // (SKIP_WAITING message below). Enabling it force-reloaded every open
  // client mid-task on deploy and made the banner dead code. The
  // sw-i18n-invariants vitest pins this stays off.
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Auth and safety APIs must always hit the network — never serve from cache.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/auth") ||
        url.pathname.startsWith("/api/safety") ||
        // i18n kill switch must never be cache-served (docs/i18n/DESIGN.md)
        url.pathname.startsWith("/api/i18n"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("RSC") === "1" &&
        request.headers.get("Next-Router-Prefetch") === "1" &&
        sameOrigin &&
        !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "pages-rsc-prefetch",
        plugins: pageCachePlugins(),
        networkTimeoutSeconds: 4,
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("RSC") === "1" && sameOrigin && !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "pages-rsc",
        plugins: pageCachePlugins(),
        networkTimeoutSeconds: 4,
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.destination === "document" && sameOrigin && !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "pages",
        plugins: pageCachePlugins(),
        networkTimeoutSeconds: 4,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
