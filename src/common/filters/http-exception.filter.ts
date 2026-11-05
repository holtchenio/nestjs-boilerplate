import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  /**
   * HttpException 保持抛出时的 body。未知错误只记日志，响应里不带堆栈。
   * @param exception
   * @param host
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response
        .status(exception.getStatus())
        .json(
          typeof body === 'string'
            ? { status: exception.getStatus(), errors: { message: body } }
            : body,
        );
      return;
    }
    this.logger.error(
      exception instanceof Error ? exception.message : 'unknown error',
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errors: { server: 'internal' },
    });
  }
}
