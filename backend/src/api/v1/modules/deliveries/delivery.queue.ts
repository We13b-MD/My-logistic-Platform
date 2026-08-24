 import { Queue } from "bullmq";
 import { redisConnection } from '../../../../config/redis';

 //create a queue for delivery related tasks (like driver matching)

 export const deliveryQueue = new Queue('deliveries-queue', {
    connection: redisConnection as any,

    defaultJobOptions:{
        attempts:3, //if a job fails retry up to 3 times automatically
        backoff: {
            type:'exponential',
            delay: 5000, //Retry is 5s then 10secs, 20 secs to prevent database storms
        },
        removeOnComplete: true,
        // Delete successful jobs immediately to keep redis memory footprint minimal
        removeOnFail: { count: 100 },
        // Cap retained failed jobs to max 100 items to inspect errors without memory leaks
    },
 })