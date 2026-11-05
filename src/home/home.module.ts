import { Module } from '@nestjs/common';
import { HomeService } from './home.service.js';
import { HomeController } from './home.controller.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
