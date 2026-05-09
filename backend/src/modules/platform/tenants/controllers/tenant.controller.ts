import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { TenantService } from '../services/tenant.service';
import { Tenant } from '../entities/tenant.entity';

@Controller('tenants')
@UseGuards(PlatformJwtAuthGuard)
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Get()
  async findAll(@RequestContext() ctx: RequestContextDto) {
    const tenants = await this.tenantService.getAllTenants(ctx);

    return {
      success: true,
      statusCode: 200,
      message: `List of tenants`,
      data: tenants,
    }
  }

  @Get(':id')
  async findOne(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenant = await this.tenantService.findByIdForUser(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: `Tenant found`,
      data: tenant,
    }
  }

  @Post()
  async create(
    @RequestContext() ctx: RequestContextDto,
    @Body() createTenantDto: CreateTenantDto,
  ) {    
    const tenant = await this.tenantService.createTenant(ctx, createTenantDto);

    return {
      success: true,
      statusCode: 201,
      message: `Tenant created successfully`,
      data: tenant,
    }
  }

  @Patch(':id')
  async update(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {

    const tenant = await this.tenantService.updateTenant(ctx, id, updateTenantDto);

    return {
      success: true,
      statusCode: 200,
      message: `Tenant updated successfully`,
      data: tenant,
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async remove(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tenantService.deleteTenant(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: `Tenant deleted successfully`,
    }
  }
}
