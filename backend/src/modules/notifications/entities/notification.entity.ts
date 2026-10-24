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

/** An in-app notification for one user (PRD 6.13). */
@Entity('notifications')
@Index('idx_notifications_user', ['orgId', 'userId', 'createdAt'])
@Index('idx_notifications_unread', ['orgId', 'userId'], {
  where: '"read_at" IS NULL',
})
export class Notification extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** The template key (`resultPublished`, …). */
  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Frontend path to open, e.g. `/portal/children/<id>/results`. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  link: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** A school's wording of a notification, replacing the code default. */
@Entity('notification_templates')
@Index('uq_notification_templates', ['orgId', 'key', 'channel', 'locale'], {
  unique: true,
})
export class NotificationTemplate extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  key: string;

  /** `inApp` or `email`. */
  @Column({ type: 'varchar', length: 16 })
  channel: string;

  @Column({ type: 'varchar', length: 2 })
  locale: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** One message on one channel to one recipient: the communication log. */
@Entity('delivery_logs')
@Index('idx_delivery_logs_created', ['orgId', 'createdAt'])
export class DeliveryLog extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `in_app` or `email` (SMS and push in 1b). */
  @Column({ type: 'varchar', length: 16 })
  channel: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  /** The email address, or the user id for in-app. */
  @Column({ type: 'varchar', length: 254 })
  recipient: string;

  @Column({ name: 'template_key', type: 'varchar', length: 40 })
  templateKey: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  /** Email body as rendered (sent by the delivery job). */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  link: string | null;

  /** `queued`, `sent` or `failed`. */
  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({
    name: 'provider_message_id',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  providerMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
