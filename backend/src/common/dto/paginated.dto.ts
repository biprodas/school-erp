import type { FindManyOptions, ObjectLiteral, Repository } from 'typeorm';
import { DEFAULT_PAGE_SIZE, PaginationQueryDto } from './pagination-query.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * One page of a list. Return it from a handler and the response envelope
 * becomes `{ success, statusCode, message, data: items, meta }`, so clients
 * that only read `data` keep receiving a plain array.
 */
export class Paginated<T> {
  readonly meta: PaginationMeta;

  constructor(
    readonly items: T[],
    total: number,
    { page, limit }: Required<Pick<PaginationQueryDto, 'page' | 'limit'>>,
  ) {
    this.meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}

/**
 * One page of `repo.find(options)` with the total count. Tenant
 * repositories use it through `BaseTenantRepository.findPage`; platform
 * services call it on their root-connection repositories.
 */
export async function findPage<T extends ObjectLiteral>(
  repo: Pick<Repository<T>, 'findAndCount'>,
  options: FindManyOptions<T>,
  { page = 1, limit = DEFAULT_PAGE_SIZE }: PaginationQueryDto = {},
): Promise<Paginated<T>> {
  const [items, total] = await repo.findAndCount({
    ...options,
    skip: (page - 1) * limit,
    take: limit,
  });
  return new Paginated(items, total, { page, limit });
}
