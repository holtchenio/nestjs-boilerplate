import { Module } from '@nestjs/common';
import { AuthGoogleService } from './auth-google.service.js';
import { ConfigModule } from '@nestjs/config';
import { AuthGoogleController } from './auth-google.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [ConfigModule, AuthModule, UsersModule],
  providers: [AuthGoogleService],
  exports: [AuthGoogleService],
  controllers: [AuthGoogleController],
})
export class AuthGoogleModule {}
