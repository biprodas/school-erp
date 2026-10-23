import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DbConfig } from '~/config';
import { STUDENT_SEARCH_DDL } from './student-search';

/**
 * Dev/e2e (schema sync): creates `pg_trgm` and the student name indexes,
 * which sync can't express. Production gets them from the
 * `StudentProfileAndGeo` migration.
 */
@Injectable()
export class StudentSearchBootstrap implements OnModuleInit {
  private readonly logger = new Logger(StudentSearchBootstrap.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<DbConfig>('db')?.sync) return;
    for (const sql of STUDENT_SEARCH_DDL) await this.dataSource.query(sql);
    this.logger.log('Student search indexes ready');
  }
}
