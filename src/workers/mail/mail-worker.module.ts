import { Module } from '@nestjs/common';
import { MailProcessor } from './mail.processor';

@Module({
  providers: [MailProcessor],
})
export class MailWorkerModule {}
