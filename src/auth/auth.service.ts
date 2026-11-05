import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import ms from 'ms';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { AuthProvidersEnum } from './auth-providers.enum';
import { SocialInterface } from '../social/interfaces/social.interface';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { NullableType } from '../utils/types/nullable.type';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { AllConfigType } from '../config/config.type';
import { RoleEnum } from '../roles/roles.enum';
import { Session } from '../session/domain/session';
import { SessionService } from '../session/session.service';
import { StatusEnum } from '../statuses/statuses.enum';
import { User } from '../users/domain/user';
import { DbClient, PrismaService } from '../database/prisma.service';
import { MailQueueService } from '../queue/mail-queue.service';
import { RefreshTokenRecord } from '../session/infrastructure/persistence/session.repository';
import { forgotPasswordSecret } from './forgot-password-secret';
import { createRefreshToken, refreshTokenHash } from './refresh-token';
import { SessionRevocationCache } from './session-revocation.cache';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly prisma: PrismaService,
    private readonly mailQueue: MailQueueService,
    private readonly revocation: SessionRevocationCache,
  ) {}

  async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw this.invalidLoginException({
        email: 'notFound',
      });
    }

    if (user.provider !== AuthProvidersEnum.email) {
      throw this.invalidLoginException({
        email: `needLoginViaProvider:${user.provider}`,
      });
    }

    if (!user.password) {
      throw this.invalidLoginException({
        password: 'incorrectPassword',
      });
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw this.invalidLoginException({
        password: 'incorrectPassword',
      });
    }

    const { session, refreshToken } = await this.issueSession(user);
    const { token, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: user.role,
      sessionId: session.id,
    });

    return {
      refreshToken,
      token,
      tokenExpires,
      user,
    };
  }

  async validateSocialLogin(
    authProvider: string,
    socialData: SocialInterface,
  ): Promise<LoginResponseDto> {
    let user: NullableType<User> = null;
    const socialEmail = socialData.email?.toLowerCase();
    let userByEmail: NullableType<User> = null;

    if (socialEmail && !socialData.emailVerified) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotVerified',
        },
      });
    }

    if (socialEmail) {
      userByEmail = await this.usersService.findByEmail(socialEmail);
    }

    if (socialData.id) {
      user = await this.usersService.findBySocialIdAndProvider({
        socialId: socialData.id,
        provider: authProvider,
      });
    }

    if (user) {
      if (socialEmail && !userByEmail) {
        user.email = socialEmail;
      }
      await this.usersService.update(user.id, user);
    } else if (userByEmail) {
      user = userByEmail;

      if (user.status?.id?.toString() === StatusEnum.inactive.toString()) {
        user.provider = authProvider;
        user.socialId = socialData.id;

        await this.usersService.update(user.id, user);
      }
    } else if (socialData.id) {
      const role = {
        id: RoleEnum.user,
      };
      const status = {
        id: StatusEnum.active,
      };

      user = await this.usersService.create({
        email: socialEmail ?? null,
        firstName: socialData.firstName ?? null,
        lastName: socialData.lastName ?? null,
        socialId: socialData.id,
        provider: authProvider,
        role,
        status,
      });

      user = await this.usersService.findById(user.id);
    }

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    const { session, refreshToken } = await this.issueSession(user);
    const { token: jwtToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: user.role,
      sessionId: session.id,
    });

    return {
      refreshToken,
      token: jwtToken,
      tokenExpires,
      user,
    };
  }

  /**
   * 创建未激活用户，并把确认信放进队列。JWT 由 Worker 发送前签发。
   * @param dto
   * @param lang
   */
  async register(dto: AuthRegisterLoginDto, lang?: string): Promise<void> {
    const user = await this.usersService.create({
      ...dto,
      email: dto.email,
      role: {
        id: RoleEnum.user,
      },
      status: {
        id: StatusEnum.inactive,
      },
    });

    await this.mailQueue.enqueue({
      kind: 'confirm-email',
      userId: user.id,
      lang: this.resolveLang(lang),
    });
  }

  async confirmEmail(hash: string): Promise<void> {
    let userId: User['id'];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        algorithms: ['HS256'],
      });

      userId = jwtData.confirmEmailUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (
      !user ||
      user?.status?.id?.toString() !== StatusEnum.inactive.toString()
    ) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    user.status = {
      id: StatusEnum.active,
    };

    await this.prisma.runInTransaction((tx) =>
      this.usersService.update(user.id, user, tx),
    );
  }

  async confirmNewEmail(hash: string): Promise<void> {
    let userId: User['id'];
    let newEmail: User['email'];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
        newEmail: User['email'];
      }>(hash, {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        algorithms: ['HS256'],
      });

      userId = jwtData.confirmEmailUserId;
      newEmail = jwtData.newEmail;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    user.email = newEmail;
    user.status = {
      id: StatusEnum.active,
    };

    await this.usersService.update(user.id, user);
  }

  /**
   * 把重置信放进队列。未注册邮箱在统一错误模式下不发信。
   * @param email
   * @param lang
   */
  async forgotPassword(email: string, lang?: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      const uniformErrors = this.configService.getOrThrow(
        'auth.uniformErrors',
        { infer: true },
      );

      // With uniform errors enabled we do not reveal whether the email is
      // registered: respond exactly like the success case and skip the mail.
      if (uniformErrors) {
        return;
      }

      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotExists',
        },
      });
    }

    await this.mailQueue.enqueue({
      kind: 'forgot-password',
      userId: user.id,
      lang: this.resolveLang(lang),
    });
  }

  /**
   * 校验重置链接后，在同一事务里作废该用户的会话并更新密码。
   * @param hash
   * @param password
   */
  async resetPassword(hash: string, password: string): Promise<void> {
    let userId: User['id'] | undefined;

    try {
      const jwtData = this.jwtService.decode<{
        forgotUserId?: User['id'];
      } | null>(hash);

      userId = jwtData?.forgotUserId;
    } catch {
      userId = undefined;
    }

    let user: NullableType<User> = null;

    if (userId !== undefined && userId !== null) {
      try {
        user = await this.usersService.findById(userId);
      } catch {
        user = null;
      }
    }

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    try {
      await this.jwtService.verifyAsync(hash, {
        secret: this.getForgotSecret(user),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    user.password = password;

    const revokedIds = await this.prisma.runInTransaction(async (tx) => {
      const ids = await this.sessionService.deleteByUserId(
        {
          userId: user.id,
          reason: 'password_reset',
        },
        tx,
      );
      await this.usersService.update(user.id, user, tx);
      await this.sessionService.recordAudit(
        {
          type: 'password_reset',
          userId: Number(user.id),
        },
        tx,
      );
      return ids;
    });
    await this.revocation.revoke(revokedIds, 'password_reset');
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.id);
  }

  /**
   * 更新当前用户。更换邮箱时只入队，不在响应里等待 SMTP。
   * @param userJwtPayload
   * @param userDto
   * @param lang
   */
  async update(
    userJwtPayload: JwtPayloadType,
    userDto: AuthUpdateDto,
    lang?: string,
  ): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.id);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'missingOldPassword',
          },
        });
      }

      if (!currentUser.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      }

      const isValidOldPassword = await bcrypt.compare(
        userDto.oldPassword,
        currentUser.password,
      );

      if (!isValidOldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      } else {
        const revokedIds = await this.prisma.runInTransaction(async (tx) => {
          const ids = await this.sessionService.deleteByUserIdWithExclude(
            {
              userId: currentUser.id,
              excludeSessionId: userJwtPayload.sessionId,
              reason: 'password_change',
            },
            tx,
          );
          await this.sessionService.recordAudit(
            {
              type: 'password_changed',
              userId: Number(currentUser.id),
              sessionId: userJwtPayload.sessionId,
            },
            tx,
          );
          return ids;
        });
        await this.revocation.revoke(revokedIds, 'password_change');
      }
    }

    if (userDto.email && userDto.email !== currentUser.email) {
      const userByEmail = await this.usersService.findByEmail(userDto.email);

      if (userByEmail && userByEmail.id !== currentUser.id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailExists',
          },
        });
      }

      await this.mailQueue.enqueue({
        kind: 'confirm-new-email',
        userId: currentUser.id,
        lang: this.resolveLang(lang),
        newEmail: userDto.email,
      });
    }

    delete userDto.email;
    delete userDto.oldPassword;

    await this.usersService.update(userJwtPayload.id, userDto);

    return this.usersService.findById(userJwtPayload.id);
  }

  /**
   * 用一次性刷新令牌轮换会话。重用会撤销整个会话后再返回 401。
   * @param rawToken
   */
  async refreshToken(
    rawToken: string,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    const secret = this.configService.getOrThrow('auth.refreshSecret', {
      infer: true,
    });
    const now = new Date();
    const outcome = await this.prisma.runInTransaction(async (tx) => {
      const current = await this.sessionService.findRefreshByHash(
        refreshTokenHash(secret, rawToken),
        tx,
      );
      if (
        !current ||
        current.revokedAt ||
        current.sessionRevokedAt ||
        current.expiresAt <= now ||
        current.sessionExpiresAt <= now
      ) {
        return { kind: 'invalid' as const };
      }
      if (current.consumedAt) {
        const reused = await this.reuseDetected(current, now, tx);
        return reused
          ? { kind: 'reuse' as const, sessionId: current.sessionId }
          : { kind: 'invalid' as const };
      }

      const refreshToken = createRefreshToken();
      const expiresAt = this.refreshExpiresAt(now);
      const next = await this.sessionService.issueRefresh(
        {
          sessionId: current.sessionId,
          tokenHash: refreshTokenHash(secret, refreshToken),
          expiresAt,
        },
        tx,
      );
      const count = await this.sessionService.consumeRefresh(
        current.id,
        next.id,
        tx,
      );
      if (count !== 1) {
        await this.sessionService.revokeFamily(current.sessionId, 'reuse', tx);
        await this.sessionService.recordAudit(
          {
            type: 'refresh_reused',
            userId: current.userId,
            sessionId: current.sessionId,
          },
          tx,
        );
        return { kind: 'reuse' as const, sessionId: current.sessionId };
      }
      await this.sessionService.touchLastUsed(current.sessionId, tx);
      await this.sessionService.recordAudit(
        {
          type: 'refresh_succeeded',
          userId: current.userId,
          sessionId: current.sessionId,
        },
        tx,
      );
      return {
        kind: 'ok' as const,
        sessionId: current.sessionId,
        userId: current.userId,
        refreshToken,
      };
    });

    if (outcome.kind === 'reuse') {
      await this.revocation.revoke([outcome.sessionId], 'reuse');
      throw new UnauthorizedException();
    }
    if (outcome.kind !== 'ok') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(outcome.userId);
    if (!user?.role) {
      throw new UnauthorizedException();
    }

    const { token, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: { id: user.role.id },
      sessionId: outcome.sessionId,
    });
    return {
      token,
      refreshToken: outcome.refreshToken,
      tokenExpires,
    };
  }

  /**
   * 撤销该用户的全部会话后软删除用户。
   * @param userJwtPayload
   */
  async softDelete(userJwtPayload: JwtPayloadType): Promise<void> {
    const revokedIds = await this.prisma.runInTransaction(async (tx) => {
      const ids = await this.sessionService.deleteByUserId(
        { userId: userJwtPayload.id, reason: 'user_deleted' },
        tx,
      );
      await this.sessionService.recordAudit(
        {
          type: 'user_deleted',
          userId: Number(userJwtPayload.id),
          sessionId: userJwtPayload.sessionId,
        },
        tx,
      );
      return ids;
    });
    await this.usersService.remove(userJwtPayload.id);
    await this.revocation.revoke(revokedIds, 'user_deleted');
  }

  /**
   * 撤销当前会话，并让尚未过期的 access token 立即失效。
   * @param data
   */
  async logout(data: Pick<JwtPayloadType, 'id' | 'sessionId'>): Promise<void> {
    await this.prisma.runInTransaction(async (tx) => {
      await this.sessionService.deleteById(data.sessionId, 'logout', tx);
      await this.sessionService.recordAudit(
        {
          type: 'logout',
          userId: Number(data.id),
          sessionId: data.sessionId,
        },
        tx,
      );
    });
    await this.revocation.revoke([data.sessionId], 'logout');
  }

  private invalidLoginException(
    errors: Record<string, string>,
  ): UnprocessableEntityException {
    const uniformErrors = this.configService.getOrThrow('auth.uniformErrors', {
      infer: true,
    });

    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: uniformErrors
        ? {
            email: 'incorrectEmailOrPassword',
            password: 'incorrectEmailOrPassword',
          }
        : errors,
    });
  }

  /**
   * 请求语言优先，否则用应用的默认语言。
   * @param lang
   */
  private resolveLang(lang?: string): string {
    return (
      lang ??
      this.configService.getOrThrow('app.fallbackLanguage', { infer: true })
    );
  }

  /**
   * 重置链接密钥。密码变化后，已经发出的链接不再通过校验。
   * @param user
   */
  private getForgotSecret(user: User): string {
    const forgotSecret = this.configService.getOrThrow('auth.forgotSecret', {
      infer: true,
    });

    return forgotPasswordSecret(forgotSecret, user.password);
  }

  /**
   * 创建会话和不透明刷新令牌。库里只保存 HMAC。
   * @param user
   */
  private async issueSession(user: User): Promise<{
    session: Session;
    refreshToken: string;
  }> {
    const refreshToken = createRefreshToken();
    const secret = this.configService.getOrThrow('auth.refreshSecret', {
      infer: true,
    });
    const expiresAt = this.refreshExpiresAt(new Date());
    const session = await this.prisma.runInTransaction(async (tx) => {
      const created = await this.sessionService.create({ user, expiresAt }, tx);
      await this.sessionService.issueRefresh(
        {
          sessionId: created.id,
          tokenHash: refreshTokenHash(secret, refreshToken),
          expiresAt,
        },
        tx,
      );
      await this.sessionService.recordAudit(
        {
          type: 'login_succeeded',
          userId: Number(user.id),
          sessionId: created.id,
        },
        tx,
      );
      return created;
    });
    return { session, refreshToken };
  }

  /**
   * 已消费令牌再次出现时，宽限为 0 则撤销整个会话。
   * @param current
   * @param now
   * @param tx
   */
  private async reuseDetected(
    current: RefreshTokenRecord,
    now: Date,
    tx: DbClient,
  ): Promise<boolean> {
    const grace = this.configService.getOrThrow('auth.reuseGraceSeconds', {
      infer: true,
    });
    const consumedAt = current.consumedAt;
    const withinGrace =
      grace > 0 &&
      consumedAt !== null &&
      now.getTime() - consumedAt.getTime() <= grace * 1000;
    if (withinGrace && current.replacedById) {
      const replacement = await this.sessionService.findRefreshById(
        current.replacedById,
        tx,
      );
      if (replacement && !replacement.consumedAt && !replacement.revokedAt) {
        return false;
      }
    }
    await this.sessionService.revokeFamily(current.sessionId, 'reuse', tx);
    await this.sessionService.recordAudit(
      {
        type: 'refresh_reused',
        userId: current.userId,
        sessionId: current.sessionId,
      },
      tx,
    );
    return true;
  }

  /**
   * @param now
   */
  private refreshExpiresAt(now: Date): Date {
    return new Date(
      now.getTime() +
        ms(
          this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        ),
    );
  }

  /**
   * 只签发 access token。刷新令牌是随机串，不再是 JWT。
   * @param data
   */
  private async getTokensData(data: {
    id: User['id'];
    role: User['role'];
    sessionId: Session['id'];
  }) {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });
    const tokenExpires = Date.now() + ms(tokenExpiresIn);
    const token = await this.jwtService.signAsync(
      {
        id: data.id,
        role: data.role,
        sessionId: data.sessionId,
      },
      {
        secret: this.configService.getOrThrow('auth.secret', { infer: true }),
        expiresIn: tokenExpiresIn,
      },
    );

    return {
      token,
      tokenExpires,
    };
  }
}
