import IORedis from 'ioredis';
import dotenv from 'dotenv'

dotenv.config();

// MaxRetriesPerRequest: null is a critical requirement for BullMQ — without it BullMQ crashes with a compatibility error.
// lazyConnect: true prevents IORedis from spamming ECONNREFUSED every second when Redis is unavailable (e.g. Render free tier).
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => {
        if (times > 3) {
            console.warn(`[Redis] Connection unavailable after ${times} retries. BullMQ job queuing disabled — deliveries will still work.`);
            return null; // stop retrying
        }
        return Math.min(times * 500, 2000); // retry up to 3 times with backoff
    },
});

redisConnection.on('error', (err: Error) => {
    // Only log the first occurrence to avoid log spam
    if ((redisConnection as any)._loggedError) return;
    (redisConnection as any)._loggedError = true;
    console.warn('[Redis] Not available — driver matching queue disabled. All other features unaffected.', err.message);
});