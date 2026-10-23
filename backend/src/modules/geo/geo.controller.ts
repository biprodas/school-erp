import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { GeoService } from './geo.service';

/** Address pickers: Division → District → Upazila (public, no sign-in). */
@ApiTags('Public / Geo')
@Controller('public/geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('divisions')
  @ResponseMessage('Divisions')
  divisions() {
    return this.geo.divisions();
  }

  @Get('divisions/:id/districts')
  @ResponseMessage('Districts')
  districts(@Param('id', ParseIntPipe) id: number) {
    return this.geo.districts(id);
  }

  @Get('districts/:id/upazilas')
  @ResponseMessage('Upazilas')
  upazilas(@Param('id', ParseIntPipe) id: number) {
    return this.geo.upazilas(id);
  }
}
