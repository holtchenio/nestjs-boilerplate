import { Injectable, Logger } from '@nestjs/common';
import { FileRepository } from './infrastructure/persistence/file.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FileOrphanCleanup {
  private readonly logger = new Logger(FileOrphanCleanup.name);

  constructor(private readonly files: FileRepository) {}

  /**
   * 只删除超过 24 小时、且没有被 user.photoId 引用的 file 行。
   * @param now
   */
  async removeUnreferenced(now = new Date()): Promise<string[]> {
    const olderThan = new Date(now.getTime() - DAY_MS);
    const ids = await this.files.findOrphanIds(olderThan);
    this.logger.log(`file orphan cleanup will delete: ${ids.join(',')}`);
    if (ids.length > 0) {
      await this.files.deleteByIds(ids);
    }
    return ids;
  }
}
