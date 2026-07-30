export function createKeyedDebounce(callback, delay = 300) {
    const timers = new Map();
    const lastArgs = new Map();

    const schedule = (key, ...args) => {
        const wait = typeof delay === "function" ? delay(key) : delay;
        if (timers.has(key)) clearTimeout(timers.get(key));
        lastArgs.set(key, args);
        const timeout = setTimeout(() => {
            timers.delete(key);
            const payload = lastArgs.get(key) || [];
            lastArgs.delete(key);
            callback(key, ...(payload || []));
        }, wait);
        timers.set(key, timeout);
    };

    schedule.flush = (key) => {
        if (!timers.has(key)) return;
        clearTimeout(timers.get(key));
        timers.delete(key);
        const payload = lastArgs.get(key) || [];
        lastArgs.delete(key);
        callback(key, ...(payload || []));
    };

    schedule.cancel = (key) => {
        if (!timers.has(key)) return;
        clearTimeout(timers.get(key));
        timers.delete(key);
        lastArgs.delete(key);
    };

    schedule.clearAll = () => {
        timers.forEach((timeout) => clearTimeout(timeout));
        timers.clear();
        lastArgs.clear();
    };

    return schedule;
}

export function withRetry(fn, { retries = 2, baseDelay = 150 } = {}) {
    return async (...args) => {
        let attempt = 0;
        let lastError;
        while (attempt <= retries) {
            try {
                return await fn(...args);
            } catch (error) {
                lastError = error;
                if (attempt === retries) break;
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            attempt += 1;
        }
        throw lastError;
    };
}

export function prepareOptimisticUpdate(items, id, updater) {
    const index = Array.isArray(items)
        ? items.findIndex((item) => item?.id === id)
        : -1;
    if (index === -1) {
        return {
            next: items,
            rollback: () => items,
            original: undefined,
        };
    }
    const original = items[index];
    const updated = updater(original);
    const next = [...items];
    next[index] = updated;
    return {
        next,
        original,
        rollback: (baseline = items) => {
            const current = [...baseline];
            current[index] = original;
            return current;
        },
    };
}
