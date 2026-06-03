import { csrfProtection } from '../src/middlewares/csrfHandler.js';
import { env } from '../src/config/env.js';

describe('CSRF Middleware Cookie Domain Configuration', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let originalCookieDomain;

    beforeAll(() => {
        originalCookieDomain = env.cookieDomain;
    });

    afterAll(() => {
        env.cookieDomain = originalCookieDomain;
    });

    beforeEach(() => {
        mockReq = {
            session: {
                csrfToken: 'test-token-123'
            },
            method: 'GET',
            headers: {},
            originalUrl: '/api/v1/test'
        };
        mockRes = {
            cookie: (name, val, options) => {
                mockRes.cookie.calls.push({ name, val, options });
            },
            status: (code) => {
                mockRes.status.calls.push(code);
                return mockRes;
            },
            json: (data) => {
                mockRes.json.calls.push(data);
            }
        };
        mockRes.cookie.calls = [];
        mockRes.status.calls = [];
        mockRes.json.calls = [];
        mockNext = () => {
            mockNext.calls++;
        };
        mockNext.calls = 0;
    });

    test('should attach domain option if env.cookieDomain is set', () => {
        env.cookieDomain = '.museobulawan.qzz.io';

        csrfProtection(mockReq, mockRes, mockNext);

        expect(mockRes.cookie.calls.length).toBe(1);
        expect(mockRes.cookie.calls[0].name).toBe('XSRF-TOKEN');
        expect(mockRes.cookie.calls[0].val).toBe('test-token-123');
        expect(mockRes.cookie.calls[0].options.domain).toBe('.museobulawan.qzz.io');
        expect(mockRes.cookie.calls[0].options.httpOnly).toBe(false);
        expect(mockNext.calls).toBe(1);
    });

    test('should NOT attach domain option if env.cookieDomain is undefined', () => {
        env.cookieDomain = undefined;

        csrfProtection(mockReq, mockRes, mockNext);

        expect(mockRes.cookie.calls.length).toBe(1);
        expect(mockRes.cookie.calls[0].name).toBe('XSRF-TOKEN');
        expect(mockRes.cookie.calls[0].val).toBe('test-token-123');
        expect(mockRes.cookie.calls[0].options.domain).toBeUndefined();
        expect(mockNext.calls).toBe(1);
    });
});
