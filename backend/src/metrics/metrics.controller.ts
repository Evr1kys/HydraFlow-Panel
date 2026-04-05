import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { NoEnvelope } from '../common/decorators/no-envelope.decorator';

@Controller('api/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('prometheus')
  @NoEnvelope()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}
