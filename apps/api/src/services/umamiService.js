import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

class UmamiService {
    constructor() {
        this.cachedToken = null;
        this.tokenExpiry = 0;
        this.cache = new Map(); // local API cache to prevent spamming
    }

    /**
     * Get or fetch an active JWT auth token for Umami
     */
    async getAuthToken() {
        // 1. If explicit API token is set in env, use it
        if (env.umami.apiToken) {
            return env.umami.apiToken;
        }

        // 2. If cached token is still valid, return it
        const now = Date.now();
        if (this.cachedToken && this.tokenExpiry > now) {
            return this.cachedToken;
        }

        // 3. Otherwise, log in to Umami
        logger.info('[Umami] Authenticating with Umami instance...');
        try {
            const loginUrl = `${env.umami.url.replace(/\/$/, '')}/api/auth/login`;
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: env.umami.username,
                    password: env.umami.password
                })
            });

            if (!response.ok) {
                throw new Error(`Auth failed with status ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.token) {
                throw new Error('No token returned from Umami login endpoint');
            }

            this.cachedToken = data.token;
            // Token is typically valid for 7 days, set cache expiry for 6 days
            this.tokenExpiry = now + 6 * 24 * 60 * 60 * 1000;
            return this.cachedToken;
        } catch (err) {
            logger.error(`[Umami] Failed to authenticate: ${err.message}`);
            throw err;
        }
    }

    /**
     * Perform an authenticated GET request to Umami API with retries on 401
     */
    async fetchFromUmami(endpoint, queryParams = {}) {
        const cacheKey = `${endpoint}?${new URLSearchParams(queryParams).toString()}`;
        const cached = this.cache.get(cacheKey);
        const now = Date.now();

        // Use cache if fresh (30 seconds)
        if (cached && cached.expiry > now) {
            return cached.value;
        }

        const makeRequest = async () => {
            const token = await this.getAuthToken();
            const baseUrl = env.umami.url.replace(/\/$/, '');
            const url = new URL(`${baseUrl}/api${endpoint}`);
            
            Object.entries(queryParams).forEach(([key, val]) => {
                url.searchParams.append(key, val);
            });

            return fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
        };

        try {
            let response = await makeRequest();

            // If unauthorized, token might have expired, retry once
            if (response.status === 401 && !env.umami.apiToken) {
                logger.warn('[Umami] Token rejected. Attempting re-login...');
                this.cachedToken = null;
                this.tokenExpiry = 0;
                response = await makeRequest();
            }

            if (!response.ok) {
                throw new Error(`Umami API returned status ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Save in cache (expires in 30 seconds)
            this.cache.set(cacheKey, {
                value: data,
                expiry: now + 30 * 1000
            });

            return data;
        } catch (err) {
            logger.error(`[Umami] API request failed for ${endpoint}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Get aggregated stats, pageviews, and metrics for dashboard
     */
    async getWebsiteAnalytics(period = '7d') {
        const websiteId = env.umami.websiteId;
        if (!websiteId) {
            throw new Error('UMAMI_WEBSITE_ID is not configured');
        }

        const endAt = Date.now();
        let startAt = endAt - 7 * 24 * 60 * 60 * 1000;
        let unit = 'day';

        if (period === '24h') {
            startAt = endAt - 24 * 60 * 60 * 1000;
            unit = 'hour';
        } else if (period === '30d') {
            startAt = endAt - 30 * 24 * 60 * 60 * 1000;
            unit = 'day';
        }

        const queryParams = {
            startAt: startAt.toString(),
            endAt: endAt.toString()
        };

        // Fetch metrics in parallel
        const [stats, pageviews, urls, referrers, devices] = await Promise.all([
            this.fetchFromUmami(`/websites/${websiteId}/stats`, queryParams),
            this.fetchFromUmami(`/websites/${websiteId}/pageviews`, { ...queryParams, unit, timezone: 'UTC' }),
            this.fetchFromUmami(`/websites/${websiteId}/metrics`, { ...queryParams, type: 'url', limit: '10' }),
            this.fetchFromUmami(`/websites/${websiteId}/metrics`, { ...queryParams, type: 'referrer', limit: '10' }),
            this.fetchFromUmami(`/websites/${websiteId}/metrics`, { ...queryParams, type: 'device', limit: '10' })
        ]);

        return {
            period,
            stats,
            pageviews,
            urls,
            referrers,
            devices
        };
    }
}

export const umamiService = new UmamiService();
