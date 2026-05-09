import { HttpException, HttpStatus } from '@nestjs/common';

export class TenantContextMissingException extends HttpException {
  constructor() {
    super(
      {
        message:
          'Tenant context is required for this route. Provide the x-tenant-id header or use a tenant subdomain.',
        error: 'Tenant Context Missing',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class TenantNotFoundException extends HttpException {
  constructor(slug?: string) {
    super(
      {
        message: slug
          ? `Tenant "${slug}" not found`
          : 'Tenant not found',
        error: 'Tenant Not Found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TenantInactiveException extends HttpException {
  constructor(slug: string) {
    super(
      {
        message: `Tenant "${slug}" is not active`,
        error: 'Tenant Inactive',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
