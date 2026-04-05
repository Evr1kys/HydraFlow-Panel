import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Global filter that converts Prisma errors into appropriate HTTP responses.
 * - P2002 (unique constraint violation) → 409 Conflict
 * - P2025 (record not found)           → 404 Not Found
 * - P2023 (invalid UUID / column data) → 400 Bad Request
 * - P2003 (foreign key constraint)     → 400 Bad Request
 * - anything else                      → 500 Internal Server Error
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = exception.meta?.['target'] as string[] | undefined;
        const field = Array.isArray(target) ? target.join(', ') : 'field';
        message = `A record with this ${field} already exists`;
        break;
      }
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2023':
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid ID format';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Related record does not exist';
        break;
      default:
        this.logger.error(
          `Unhandled Prisma error [${exception.code}]: ${exception.message}`,
        );
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : undefined,
    });
  }
}
