import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../mail/mail.module';
import { UsersModule } from '../../users/users.module';
import { MailJobHandler } from './mail-job.handler';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [UsersModule, MailModule, JwtModule.register({})],
  providers: [MailJobHandler, MailProcessor],
})
export class MailWorkerModule {}
