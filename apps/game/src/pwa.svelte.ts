/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';
import { kvGet, kvSet } from './db';

const INSTALL_DISMISSED = 'installHintDismissed';

/** How often to look for a new edition while the app stays open. */
const UPDATE_INTERVAL_MS = 30 * 60 * 1000;
/** Floor between checks, so resuming the app repeatedly doesn't hammer the site. */
const UPDATE_THROTTLE_MS = 5 * 60 * 1000;

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports as Mac, so treat a touch-capable Mac as iPad.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Service worker lifecycle and install guidance. Updates are never applied
 * mid-game: the player is offered a quiet prompt and chooses when to reload.
 */
export class PwaState {
  updateReady = $state(false);
  showInstallHint = $state(false);
  private applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

  private lastCheck = 0;

  async init(): Promise<void> {
    this.applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: () => (this.updateReady = true),
      /**
       * Registering only checks for a new worker at startup, and an installed
       * PWA can stay open for days — so it would never notice a new edition.
       * Check periodically and whenever the app is brought back to the front.
       * The worker script is fetched with cache: 'no-store' because the host
       * serves it with max-age, which would otherwise hide a fresh build.
       */
      onRegisteredSW: (swUrl, registration) => {
        if (!registration) return;
        const check = async () => {
          if (document.visibilityState !== 'visible' || !navigator.onLine) return;
          if (Date.now() - this.lastCheck < UPDATE_THROTTLE_MS) return;
          this.lastCheck = Date.now();
          try {
            const res = await fetch(swUrl, { cache: 'no-store' });
            if (res.ok) await registration.update();
          } catch {
            /* offline; the next check will do */
          }
        };
        setInterval(() => void check(), UPDATE_INTERVAL_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void check();
        });
      },
    });

    // Installed PWAs are exempt from Safari's storage eviction; ask anyway.
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* not supported; play continues regardless */
    }

    if (isIos() && !isStandalone()) {
      const dismissed = await kvGet<boolean>(INSTALL_DISMISSED);
      if (!dismissed) this.showInstallHint = true;
    }
  }

  async applyUpdateNow(): Promise<void> {
    await this.applyUpdate?.(true);
  }

  dismissUpdate(): void {
    this.updateReady = false;
  }

  async dismissInstallHint(): Promise<void> {
    this.showInstallHint = false;
    await kvSet(INSTALL_DISMISSED, true);
  }
}

export const pwa = new PwaState();
