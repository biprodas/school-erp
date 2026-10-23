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
import { GeoDistrict } from '~/modules/geo/entities/geo-district.entity';
import { GeoDivision } from '~/modules/geo/entities/geo-division.entity';
import { GeoUpazila } from '~/modules/geo/entities/geo-upazila.entity';
import { AddressType } from '../enums/address-type.enum';
import { Student } from './student.entity';

@Entity('student_addresses')
@Index('uq_student_address_type', ['orgId', 'studentId', 'addressType'], {
  unique: true,
})
export class StudentAddress extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'address_type', type: 'varchar', length: 16 })
  addressType: AddressType;

  @Column({ name: 'address_line_1', type: 'varchar', length: 255 })
  addressLine1: string;

  @Column({
    name: 'address_line_2',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state: string | null;

  /** Division / District / Upazila pickers (PRD 6.6), kept consistent. */
  @Column({ name: 'division_id', type: 'int', nullable: true })
  divisionId: number | null;

  @ManyToOne(() => GeoDivision, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'division_id' })
  division?: GeoDivision | null;

  @Column({ name: 'district_id', type: 'int', nullable: true })
  districtId: number | null;

  @ManyToOne(() => GeoDistrict, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'district_id' })
  geoDistrict?: GeoDistrict | null;

  @Column({ name: 'upazila_id', type: 'int', nullable: true })
  upazilaId: number | null;

  @ManyToOne(() => GeoUpazila, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'upazila_id' })
  upazila?: GeoUpazila | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
