import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { RoomType } from '../enums/room-type.enum';

/** A room (home room of a section; exam halls and timetable later). */
@Entity('rooms')
@Index('uq_rooms_org_name', ['orgId', 'name'], { unique: true })
export class Room extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  building: string | null;

  /** Seats; exam room allocation uses it. */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ type: 'varchar', length: 16, default: RoomType.CLASSROOM })
  type: RoomType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
