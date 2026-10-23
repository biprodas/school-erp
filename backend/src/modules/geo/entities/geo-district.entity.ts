import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { GeoDivision } from './geo-division.entity';

/** BBS district (platform data, same for every school; seeded from `~/shared/geo`). */
@Entity('geo_districts')
@Index('idx_geo_districts_division', ['divisionId'])
export class GeoDistrict {
  /** Stable id from the seed data; addresses store it. */
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'division_id', type: 'int' })
  divisionId: number;

  @ManyToOne(() => GeoDivision, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'division_id' })
  division?: GeoDivision;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 80 })
  nameBn: string;
}
