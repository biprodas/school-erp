import { PaginationQueryDto } from './pagination-query.dto';

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
