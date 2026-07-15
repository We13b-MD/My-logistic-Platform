import IORedis from 'ioredis';
import dotenv from 'dotenv'

dotenv.config();

//MaxRetiresperRequest: null is a critical requirement for bullmq without  it ,BullMq willl  crash  with a compatibility error

export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379',{
    maxRetriesPerRequest: null,
})