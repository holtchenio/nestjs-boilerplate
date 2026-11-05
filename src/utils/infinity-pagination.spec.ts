import { infinityPagination } from './infinity-pagination.js';

describe('infinityPagination', () => {
  it('should keep a short page and report no next page', () => {
    const page = infinityPagination([1], { page: 1, limit: 2 });

    expect(page.data).toEqual([1]);
    expect(page.hasNextPage).toBe(false);
  });

  it('should drop the extra row and report a next page', () => {
    const page = infinityPagination([1, 2, 3], { page: 1, limit: 2 });

    expect(page.data).toEqual([1, 2]);
    expect(page.hasNextPage).toBe(true);
  });
});
