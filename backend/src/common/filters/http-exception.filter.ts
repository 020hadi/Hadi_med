import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : undefined;

    let message: string | string[] = 'Internal server error';
    let details: unknown;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      exceptionResponse !== null &&
      typeof exceptionResponse === 'object'
    ) {
      const body = exceptionResponse as Record<string, unknown>;

      const rawMessage = body['message'];

      if (typeof rawMessage === 'string' || Array.isArray(rawMessage)) {
        message = rawMessage as string | string[];
      }

      details = body['details'];
    }

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error
          ? exception.stack
          : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
