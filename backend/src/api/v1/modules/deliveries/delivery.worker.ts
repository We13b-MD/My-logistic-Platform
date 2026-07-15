import { Worker, Job } from 'bullmq' 
import { redisConnection } from '../../../../config/redis';
import { NearestDriverStrategy } from './delivery.service';



const matchingStrategy = new NearestDriverStrategy();

//create the worker to process jobs from the delivereis queue

export const deliveryWorker = new Worker(
    'deliveries-queue',
    async(job: Job) =>{
        const {deliveryId, tenantId, pickupLatitude,pickupLongitude} = job.data;
        if(job.name === 'MATCH_DRIVER'){
            console.log(`[worker]  Strting driver matching for delivery: ${deliveryId}`);

            const assignedDriverId = await matchingStrategy.findAndAssignDriver(
                deliveryId,
                tenantId,
                pickupLatitude,
                pickupLongitude
            );

            //if no driver is matched we throw an error 

            if(!assignedDriverId){
                throw new Error(`No available drivers found in range for deivery for delivery:${deliveryId}`)
            }
          console.log(`[Worker] Successfully assigned driver ${assignedDriverId} to delivery ${deliveryId}`)

        }
    },

    {
        connection: redisConnection as any,
        concurrency: 5,//limit to 5 parallel databases matches a any one milliseconds 
    }
)

//event listeners  to log results
deliveryWorker.on('completed',(job) =>{
    console.log(`[Worker] Job ${job.id} completed successfullly`)
});

deliveryWorker.on('failed', (job, err) =>{
    console.error(`[Worker] Job ${job?.id} failed with error:${err.message}`)
})

