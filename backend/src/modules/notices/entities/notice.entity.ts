import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { User } from '~/modules/users/entities/user.entity';
import type { Audience } from '../audience';

/**
 * A notice (PRD 6.13 notice board): targeted, scheduled with `publish_at`,
 * optionally pinned, expiring and public (the school's home page).
 */
@Entity('notices')
@Index('idx_notices_publish', ['orgId', 'publishAt'])
export class Notice extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    name: 'attachment_file_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  attachmentFileIds: string[];

  @Column({ type: 'jsonb' })
  audience: Audience;

  @Column({ name: 'publish_at', type: 'timestamptz' })
  publishAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  /** Shown on the school's public home page too. */
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  /** When its audience was notified (on publishing). */
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** A read receipt. */
@Entity('notice_reads')
@Index('uq_notice_reads', ['orgId', 'noticeId', 'userId'], { unique: true })
export class NoticeRead extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notice_id', type: 'uuid' })
  noticeId: string;

  @ManyToOne(() => Notice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notice_id' })
  notice?: Notice;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'read_at', type: 'timestamptz' })
  readAt: Date;
}
