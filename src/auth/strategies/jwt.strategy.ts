import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveAccessSecret } from '../access-token-secret';
import { OrNeverType } from '../../utils/types/or-never.type';
import { JwtPayloadType } from './types/jwt-payload.type';
import { AllConfigType } from '../../config/config.type';
import { SessionService } from '../../session/session.service';
import { SessionRevocationCache } from '../../session/session-revocation.cache';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly sessionService: SessionService,
    private readonly revocation: SessionRevocationCache,
    jwtService: JwtService,
  ) {
    const keyring = {
      currentKid: configService.getOrThrow('auth.accessKid', { infer: true }),
      currentSecret: configService.getOrThrow('auth.secret', { infer: true }),
      previous: configService.getOrThrow('auth.previousSecrets', {
        infer: true,
      }),
    };
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['HS256'],
      secretOrKeyProvider: (_request, rawToken, done) => {
        const secret = resolveAccessSecret(rawToken, keyring, jwtService);
        if (!secret) {
          done(new Error('Access token is missing a known kid'));
          return;
        }
        done(null, secret);
      },
    });
  }

  /**
   * 先看 Redis 撤销标记，未命中再查会话。缓存故障时回退数据库。
   * @param payload
   */
  public async validate(
    payload: JwtPayloadType,
  ): Promise<OrNeverType<JwtPayloadType>> {
    if (!payload.id || !payload.sessionId) {
      throw new UnauthorizedException();
    }
    if (!this.configService.getOrThrow('auth.sessionCheck', { infer: true })) {
      return payload;
    }

    const cached = await this.revocation.read(payload.sessionId);
    if (cached === 'revoked') {
      throw new UnauthorizedException();
    }

    const session = await this.sessionService.findById(payload.sessionId);
    const expired = session ? session.expiresAt.getTime() <= Date.now() : true;
    if (!session || session.revokedAt || expired) {
      await this.revocation.revoke(
        [payload.sessionId],
        session?.revokeReason ?? 'missing',
      );
      throw new UnauthorizedException();
    }

    return payload;
  }
}
