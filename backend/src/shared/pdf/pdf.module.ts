import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PdfService } from './pdf.service';

/** Headless-Chrome PDF rendering with bundled Bangla fonts. */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
