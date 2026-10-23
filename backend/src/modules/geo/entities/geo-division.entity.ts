import { Column, Entity, PrimaryColumn } from 'typeorm';

/** BBS division (platform data, same for every school; seeded from `~/shared/geo`). */
@Entity('geo_divisions')
export class GeoDivision {
  /** Stable id from the seed data; addresses store it. */
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 80 })
  nameBn: string;
}
