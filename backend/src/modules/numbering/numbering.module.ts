import { Module } from '@nestjs/common';
import { NumberingService } from './numbering.service';

/** Per-school counters for student IDs, receipts, invoices, certificates. */
@Module({
  providers: [NumberingService],
  exports: [NumberingService],
})
export class NumberingModule {}
