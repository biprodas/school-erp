import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  FileUpload,
  requireFile,
} from '~/modules/files/file-upload.interceptor';
import { CancelDto } from '../dto/invoice.dto';
import {
  BookQueryDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  FilterExpenseDto,
} from '../dto/report.dto';
import { ExpenseService } from '../services/expense.service';
import { LedgerService } from '../services/ledger.service';

/** Expense vouchers and their categories (PRD 6.10 ledger). */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @Get('categories')
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Expense categories')
  categories() {
    return this.expenses.categories();
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @ResponseMessage('Expense category created')
  createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.expenses.createCategory(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Expenses')
  findAll(@Query() filter: FilterExpenseDto) {
    return this.expenses.findFiltered(filter);
  }

  /** Multipart `file` (image or PDF); pass its id in `attachmentFileIds`. */
  @Post('attachments')
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @UseInterceptors(FileUpload('attachment'))
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Attachment uploaded')
  upload(@UploadedFile() file?: Express.Multer.File) {
    return this.expenses.uploadAttachment(requireFile(file));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @ResponseMessage('Expense recorded')
  create(@Body() dto: CreateExpenseDto) {
    return this.expenses.create(dto);
  }

  /** Keeps the voucher and reverses its ledger entry. */
  @Post(':id/void')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @ResponseMessage('Expense voided')
  void(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.expenses.void(id, dto.reason);
  }
}

/** The cash book and bank book. */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('ledger')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('book')
  @RequirePermissions(PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Ledger book')
  book(@Query() query: BookQueryDto) {
    return this.ledger.book(query.account, query.from, query.to);
  }
}
