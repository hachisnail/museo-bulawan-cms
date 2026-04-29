export class AsyncMutex {
    constructor() {
        this.locks = new Map();
    }

    async acquire(key) {
        if (!this.locks.has(key)) {
            this.locks.set(key, Promise.resolve());
        }

        let resolveLock;
        const nextLock = new Promise(resolve => { resolveLock = resolve; });
        const currentLock = this.locks.get(key);

        this.locks.set(key, currentLock.then(() => nextLock));

        await currentLock;
        
        return () => {
            resolveLock();
            if (this.locks.get(key) === nextLock) {
                this.locks.delete(key);
            }
        };
    }

    async runExclusive(key, task) {
        const release = await this.acquire(key);
        try {
            return await task();
        } finally {
            release();
        }
    }
}

export const globalMutex = new AsyncMutex();
