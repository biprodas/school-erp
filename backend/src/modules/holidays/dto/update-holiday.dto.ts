import { PartialType } from '@nestjs/swagger';
import { CreateHolidayDto } from './create-holiday.dto';

export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
