import { DefaultJobOptions } from 'bullmq';

const daySeconds = 24 * 60 * 60;

export const mailDefaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: {
    age: daySeconds,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * daySeconds,
  },
};
