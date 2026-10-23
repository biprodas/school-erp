import { Injectable } from '@nestjs/common';
import { normalizePhone } from '~/common/identity/identifier';
import { DepartmentService } from '~/modules/departments/department.service';
import { DesignationService } from '~/modules/designations/designation.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { EmployeeGender } from '~/modules/employees/enums/employee-gender.enum';
import { EmploymentType } from '~/modules/employees/enums/employment-type.enum';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import type {
  ParsedRow,
  RowError,
  SheetColumn,
} from '~/shared/spreadsheet/spreadsheet';
import { ImportType } from '../enums/import.enum';
import { addError, key, type Importer } from './importer';

export interface StaffImportRow {
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  nameBn?: string;
  email?: string;
  phone?: string;
  gender?: EmployeeGender;
  dob?: string;
  joiningDate?: string;
  department?: string;
  designation?: string;
  employmentType?: EmploymentType;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The staff directory from Excel (PRD 6.2 step 7). Logins are not made
 * here: invite each person from the directory afterwards.
 */
@Injectable()
export class StaffImporter implements Importer<StaffImportRow> {
  readonly type = ImportType.STAFF;
  readonly permission = PERMISSIONS.EMPLOYEES_IMPORT;

  private lookups?: Promise<{
    departments: Map<string, string>;
    designations: Map<string, string>;
  }>;

  constructor(
    private readonly employees: EmployeeService,
    private readonly departments: DepartmentService,
    private readonly designations: DesignationService,
  ) {}

  async columns(): Promise<SheetColumn<StaffImportRow>[]> {
    // Dropdowns only while the list fits Excel's 255-character limit.
    const options = (all: string[]) =>
      all.length && all.join(',').length < 250 ? all : undefined;
    const deps = (
      await this.departments.findFiltered({ page: 1, limit: 100 })
    ).items.map((d) => d.name);
    const titles = (
      await this.designations.findFiltered({ page: 1, limit: 100 })
    ).items.map((d) => d.title);
    return [
      { key: 'employeeNumber', header: 'Employee number' },
      {
        key: 'firstName',
        header: 'First name',
        required: true,
        example: 'Ayesha',
      },
      {
        key: 'lastName',
        header: 'Last name',
        required: true,
        example: 'Rahman',
      },
      { key: 'nameBn', header: 'Name (Bangla)', width: 22 },
      { key: 'email', header: 'Email', example: 'ayesha@example.com' },
      { key: 'phone', header: 'Phone', example: '01812345678' },
      {
        key: 'gender',
        header: 'Gender',
        options: Object.values(EmployeeGender),
      },
      { key: 'dob', header: 'Date of birth', type: 'date' },
      { key: 'joiningDate', header: 'Joining date', type: 'date' },
      { key: 'department', header: 'Department', options: options(deps) },
      { key: 'designation', header: 'Designation', options: options(titles) },
      {
        key: 'employmentType',
        header: 'Employment type',
        options: Object.values(EmploymentType),
      },
    ];
  }

  async validate(
    rows: ParsedRow<StaffImportRow>[],
  ): Promise<Map<number, RowError[]>> {
    const errors = new Map<number, RowError[]>();
    const { departments, designations } = await this.load();
    const numbers = new Map<string, number>();
    for (const { row, values: v } of rows) {
      const err = (column: string, code: string, message: string) =>
        addError(errors, row, column, code, message);
      if (v.employeeNumber) {
        const n = String(v.employeeNumber).trim();
        if (numbers.has(n)) {
          err(
            'Employee number',
            'DUPLICATE_IN_FILE',
            `Same number as row ${numbers.get(n)}`,
          );
        } else if (await this.employees.findByEmployeeNumber(n)) {
          err(
            'Employee number',
            'DUPLICATE_IN_DB',
            'This employee number is already in use',
          );
        }
        numbers.set(n, row);
      }
      if (v.email && !EMAIL.test(String(v.email))) {
        err('Email', 'INVALID_EMAIL', 'Not a valid email address');
      }
      if (v.phone && !normalizePhone(String(v.phone))) {
        err('Phone', 'INVALID_PHONE', 'Not a valid phone number');
      }
      if (v.department && !departments.has(key(v.department))) {
        err(
          'Department',
          'UNKNOWN_DEPARTMENT',
          `No department "${v.department}"`,
        );
      }
      if (v.designation && !designations.has(key(v.designation))) {
        err(
          'Designation',
          'UNKNOWN_DESIGNATION',
          `No designation "${v.designation}"`,
        );
      }
    }
    return errors;
  }

  async commitRow(v: StaffImportRow): Promise<Record<string, unknown>> {
    const { departments, designations } = await this.load();
    const employee = await this.employees.create({
      employeeNumber: v.employeeNumber
        ? String(v.employeeNumber).trim()
        : undefined,
      firstName: v.firstName,
      lastName: v.lastName,
      nameBn: v.nameBn,
      email: v.email,
      phone: v.phone
        ? (normalizePhone(String(v.phone)) ?? undefined)
        : undefined,
      gender: v.gender,
      dob: v.dob,
      joiningDate: v.joiningDate,
      employmentType: v.employmentType,
      departmentId: v.department
        ? departments.get(key(v.department))
        : undefined,
      designationId: v.designation
        ? designations.get(key(v.designation))
        : undefined,
    });
    return { employeeId: employee.id, employeeNumber: employee.employeeNumber };
  }

  private load() {
    this.lookups ??= (async () => ({
      departments: new Map(
        (
          await this.departments.findFiltered({ page: 1, limit: 100 })
        ).items.map((d) => [key(d.name), d.id]),
      ),
      designations: new Map(
        (
          await this.designations.findFiltered({ page: 1, limit: 100 })
        ).items.map((d) => [key(d.title), d.id]),
      ),
    }))();
    return this.lookups;
  }
}
