import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../mail/mail.module.js';
import { UsersModule } from '../../users/users.module.js';
import { MailJobHandler } from './mail-job.handler.js';
import { MailProcessor } from './mail.processor.js';

@Module({
  imports: [UsersModule, MailModule, JwtModule.register({})],
  providers: [MailJobHandler, MailProcessor],
})
export class MailWorkerModule {}
