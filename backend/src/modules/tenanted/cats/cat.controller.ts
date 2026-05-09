import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatService } from './cat.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { FilterCatDto } from './dto/filter-cat.dto';

@Controller('cats')
@UseGuards(JwtAuthGuard)
export class CatController {
  constructor(private readonly catService: CatService) {}

  @Post()
  create(@Body() dto: CreateCatDto) {
    return this.catService.create(dto);
  }

  @Get()
  findAll(@Query() filterCatDto: FilterCatDto) {
    return this.catService.findAll(filterCatDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.catService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatDto,
  ) {
    return this.catService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.catService.remove(id);
  }
}
