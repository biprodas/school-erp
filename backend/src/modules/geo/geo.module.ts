import { Global, Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoSeeder } from './geo.seeder';
import { GeoService } from './geo.service';

/** Bangladesh administrative units (platform data). Global: addresses everywhere use it. */
@Global()
@Module({
  controllers: [GeoController],
  providers: [GeoService, GeoSeeder],
  exports: [GeoService],
})
export class GeoModule {}
