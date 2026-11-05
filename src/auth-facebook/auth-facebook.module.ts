import { Module } from '@nestjs/common';
import { AuthFacebookService } from './auth-facebook.service.js';
import { ConfigModule } from '@nestjs/config';
import { AuthFacebookController } from './auth-facebook.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthFacebookService],
  exports: [AuthFacebookService],
  controllers: [AuthFacebookController],
})
export class AuthFacebookModule {}
