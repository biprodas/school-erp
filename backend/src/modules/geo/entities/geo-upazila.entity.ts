import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { GeoDistrict } from './geo-district.entity';

/** BBS upazila (platform data, same for every school; seeded from `~/shared/geo`). */
@Entity('geo_upazilas')
@Index('idx_geo_upazilas_district', ['districtId'])
export class GeoUpazila {
  /** Stable id from the seed data; addresses store it. */
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'district_id', type: 'int' })
  districtId: number;

  @ManyToOne(() => GeoDistrict, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'district_id' })
  district?: GeoDistrict;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 80 })
  nameBn: string;
}
