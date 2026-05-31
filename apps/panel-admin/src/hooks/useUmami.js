/**
 * useUmami
 *
 * Safe wrapper around the Umami browser analytics API.
 * Silently no-ops if the script hasn't loaded yet (env vars not set,
 * ad-blockers, or Umami instance unreachable).
 *
 * Usage:
 *   const { track } = useUmami();
 *   track('notification_drawer_opened');
 *   track('notification_read', { type: 'warning', title: 'Low storage' });
 */
export function useUmami() {
    const track = (eventName, eventData) => {
        if (typeof window === 'undefined' || !window.umami) return;

        try {
            window.umami.track(eventName, eventData);
            console.log('[Umami] track:', eventName, eventData ?? '');
        } catch (err) {
            console.warn('[Umami] track failed:', err);
        }
    };

    return { track };
}
