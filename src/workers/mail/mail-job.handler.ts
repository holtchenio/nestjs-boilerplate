import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import ms from 'ms';
import { forgotPasswordSecret } from '../../auth/forgot-password-secret.js';
import { AllConfigType } from '../../config/config.type.js';
import { MailService } from '../../mail/mail.service.js';
import { MailJob } from '../../queue/mail-job.js';
import { UsersService } from '../../users/users.service.js';

@Injectable()
export class MailJobHandler {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * 按邮件种类签发原来的 JWT，再交给邮件服务发送。
   * @param job
   */
  async handle(job: MailJob): Promise<void> {
    if (job.kind === 'confirm-email') {
      await this.sendConfirmEmail(job);
      return;
    }
    if (job.kind === 'forgot-password') {
      await this.sendForgotPassword(job);
      return;
    }
    await this.sendConfirmNewEmail(job);
  }

  /**
   * @param job
   */
  private async sendConfirmEmail(
    job: Extract<MailJob, { kind: 'confirm-email' }>,
  ): Promise<void> {
    const user = await this.usersService.findById(job.userId);
    if (!user?.email) {
      return;
    }
    const hash = await this.jwtService.signAsync(
      { confirmEmailUserId: user.id },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );
    await this.mailService.userSignUp({
      to: user.email,
      lang: job.lang,
      data: { hash },
    });
  }

  /**
   * @param job
   */
  private async sendForgotPassword(
    job: Extract<MailJob, { kind: 'forgot-password' }>,
  ): Promise<void> {
    const user = await this.usersService.findById(job.userId);
    if (!user?.email) {
      return;
    }
    const tokenExpiresIn = this.configService.getOrThrow('auth.forgotExpires', {
      infer: true,
    });
    const hash = await this.jwtService.signAsync(
      { forgotUserId: user.id },
      {
        secret: forgotPasswordSecret(
          this.configService.getOrThrow('auth.forgotSecret', { infer: true }),
          user.password,
        ),
        expiresIn: tokenExpiresIn,
      },
    );
    await this.mailService.forgotPassword({
      to: user.email,
      lang: job.lang,
      data: {
        hash,
        tokenExpires: Date.now() + ms(tokenExpiresIn),
      },
    });
  }

  /**
   * @param job
   */
  private async sendConfirmNewEmail(
    job: Extract<MailJob, { kind: 'confirm-new-email' }>,
  ): Promise<void> {
    const user = await this.usersService.findById(job.userId);
    if (!user) {
      return;
    }
    const hash = await this.jwtService.signAsync(
      { confirmEmailUserId: user.id, newEmail: job.newEmail },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );
    await this.mailService.confirmNewEmail({
      to: job.newEmail,
      lang: job.lang,
      data: { hash },
    });
  }
}
