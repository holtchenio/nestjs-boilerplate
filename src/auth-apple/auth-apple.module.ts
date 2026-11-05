import { Module } from '@nestjs/common';
import { AuthAppleService } from './auth-apple.service.js';
import { ConfigModule } from '@nestjs/config';
import { AuthAppleController } from './auth-apple.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [ConfigModule, AuthModule, UsersModule],
  providers: [AuthAppleService],
  exports: [AuthAppleService],
  controllers: [AuthAppleController],
})
export class AuthAppleModule {}
