/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';
import { kvGet, kvSet } from './db';

const INSTALL_DISMISSED = 'installHintDismissed';

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

  async init(): Promise<void> {
    this.applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: () => (this.updateReady = true),
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
