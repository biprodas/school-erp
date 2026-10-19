import ExcelJS from 'exceljs';
import {
  buildTemplate,
  parseSheet,
  writeSheet,
  type SheetColumn,
} from './spreadsheet';

interface Row {
  name: string;
  roll: number;
  dob: string;
  gender: string;
  hostel: boolean;
}

const COLUMNS: SheetColumn<Row>[] = [
  {
    key: 'name',
    header: 'Student name',
    required: true,
    example: 'রহিম উদ্দিন',
  },
  { key: 'roll', header: 'Roll', type: 'number', required: true, example: 1 },
  { key: 'dob', header: 'Date of birth', type: 'date', example: '15/03/2014' },
  { key: 'gender', header: 'Gender', options: ['male', 'female', 'other'] },
  { key: 'hostel', header: 'Hostel', type: 'boolean' },
];

async function workbook(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('spreadsheet helpers', () => {
  it('builds a template whose example row parses cleanly', async () => {
    const result = await parseSheet(await buildTemplate(COLUMNS), COLUMNS);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { row: 2, values: { name: 'রহিম উদ্দিন', roll: 1, dob: '2014-03-15' } },
    ]);
  });

  it('converts types and matches headers loosely', async () => {
    const file = await workbook([
      ['student  NAME', 'roll', 'Date of Birth', 'gender', 'hostel'],
      ['Karim', '12', '2013-12-01', 'male', 'Yes'],
      [],
      ['Rina', 7, new Date(Date.UTC(2014, 0, 2)), 'female', 'no'],
    ]);

    const { rows, errors } = await parseSheet(file, COLUMNS);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        row: 2,
        values: {
          name: 'Karim',
          roll: 12,
          dob: '2013-12-01',
          gender: 'male',
          hostel: true,
        },
      },
      {
        row: 4,
        values: {
          name: 'Rina',
          roll: 7,
          dob: '2014-01-02',
          gender: 'female',
          hostel: false,
        },
      },
    ]);
  });

  it('collects every row error with its row and column', async () => {
    const file = await workbook([
      ['Student name', 'Roll', 'Date of birth', 'Gender', 'Hostel'],
      ['', 'abc', '31/02/2014', 'boy', 'maybe'],
    ]);

    const { errors } = await parseSheet(file, COLUMNS);

    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([
      [2, 'Student name', 'REQUIRED'],
      [2, 'Roll', 'INVALID_NUMBER'],
      [2, 'Date of birth', 'INVALID_DATE'],
      [2, 'Gender', 'INVALID_OPTION'],
      [2, 'Hostel', 'INVALID_BOOLEAN'],
    ]);
  });

  it('reports a missing required column once, without row errors', async () => {
    const file = await workbook([['Student name'], ['Karim']]);

    const { rows, errors } = await parseSheet(file, COLUMNS);

    expect(rows).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({
        row: 1,
        column: 'Roll',
        code: 'MISSING_COLUMN',
      }),
    ]);
  });

  it('reads CSV input', async () => {
    const csv = Buffer.from('Student name,Roll\nKarim,3\n');
    const { rows, errors } = await parseSheet(csv, COLUMNS.slice(0, 2), 'csv');

    expect(errors).toEqual([]);
    expect(rows).toEqual([{ row: 2, values: { name: 'Karim', roll: 3 } }]);
  });

  it('writes rows that read back the same', async () => {
    const file = await writeSheet(COLUMNS.slice(0, 2), [
      { name: 'Karim', roll: 3 },
    ]);
    const { rows } = await parseSheet(file, COLUMNS.slice(0, 2));

    expect(rows).toEqual([{ row: 2, values: { name: 'Karim', roll: 3 } }]);
  });
});
