import { Reflector } from '@nestjs/core';

/**
 * Message placed in the `{ success, statusCode, message, data }` envelope for
 * this handler (or every handler of a controller). Defaults to `'OK'`.
 *
 * @example
 * @Post()
 * @ResponseMessage('Department created')
 * create(@Body() dto: CreateDepartmentDto) {
 *   return this.departmentService.create(dto);
 * }
 */
export const ResponseMessage = Reflector.createDecorator<string>();

/**
 * Sends the handler's return value as-is, without the response envelope
 * (e.g. health checks, HTML pages, file downloads).
 */
export const RawResponse = Reflector.createDecorator<boolean>({
  transform: () => true,
});
