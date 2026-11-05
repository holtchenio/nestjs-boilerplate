import { Module } from '@nestjs/common';
import { AuthGoogleService } from './auth-google.service.js';
import { ConfigModule } from '@nestjs/config';
import { AuthGoogleController } from './auth-google.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthGoogleService],
  exports: [AuthGoogleService],
  controllers: [AuthGoogleController],
})
export class AuthGoogleModule {}
