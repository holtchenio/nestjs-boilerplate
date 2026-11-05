import { FileOrphanCleanup } from './file-orphan-cleanup.js';
import { FileRepository } from './infrastructure/persistence/file.repository.js';

describe('FileOrphanCleanup', () => {
  it('should delete only the ids the repository reports as orphans', async () => {
    const deleted: string[][] = [];
    const repository = {
      findOrphanIds: vi.fn(() => Promise.resolve(['orphan-1'])),
      deleteByIds: vi.fn((ids: string[]) => {
        deleted.push(ids);
        return Promise.resolve();
      }),
    } as unknown as FileRepository;
    const cleanup = new FileOrphanCleanup(repository);
    const now = new Date('2026-11-05T00:00:00.000Z');

    await expect(cleanup.removeUnreferenced(now)).resolves.toEqual([
      'orphan-1',
    ]);
    expect(repository.findOrphanIds).toHaveBeenCalledWith(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
    );
    expect(deleted).toEqual([['orphan-1']]);
    expect(deleted.flat()).not.toContain('referenced-1');
  });

  it('should not delete when nothing is unreferenced', async () => {
    const repository = {
      findOrphanIds: vi.fn(() => Promise.resolve([])),
      deleteByIds: vi.fn(),
    } as unknown as FileRepository;

    await new FileOrphanCleanup(repository).removeUnreferenced();

    expect(repository.deleteByIds).not.toHaveBeenCalled();
  });
});
