import { IPaginationOptions } from './types/pagination-options.js';
import { InfinityPaginationResponseDto } from './dto/infinity-pagination-response.dto.js';

/**
 * 仓储多取一行。多出来的那行只用来判断下一页，不返回给客户端。
 * @param data
 * @param options
 */
export const infinityPagination = <T>(
  data: T[],
  options: IPaginationOptions,
): InfinityPaginationResponseDto<T> => {
  const hasNextPage = data.length > options.limit;
  return {
    data: hasNextPage ? data.slice(0, options.limit) : data,
    hasNextPage,
  };
};
