import { StudentController } from './student.controller';
import { StudentService } from '../services/student.service';
import { StudentStatus } from '../enums/student-status.enum';

describe('StudentController', () => {
  let controller: StudentController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      findFiltered: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new StudentController(service as unknown as StudentService);
  });

  it('wraps findAll in the standard response envelope', async () => {
    service.findFiltered.mockResolvedValue([{ id: 's-1' }]);

    const result = await controller.findAll({ status: StudentStatus.ACTIVE });

    expect(service.findFiltered).toHaveBeenCalledWith({
      status: StudentStatus.ACTIVE,
    });
    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'List of students',
      data: [{ id: 's-1' }],
    });
  });

  it('returns 201 envelope on create', async () => {
    service.create.mockResolvedValue({ id: 's-new' });

    const result = await controller.create({
      admissionNumber: 'ADM-100',
      firstName: 'A',
      lastName: 'B',
    });

    expect(result.statusCode).toBe(201);
    expect(result.data).toEqual({ id: 's-new' });
    expect(result.message).toContain('s-new');
  });

  it('delegates findOne to the service', async () => {
    service.findById.mockResolvedValue({ id: 's-1' });

    const result = await controller.findOne('s-1');

    expect(service.findById).toHaveBeenCalledWith('s-1');
    expect(result.data).toEqual({ id: 's-1' });
  });

  it('delegates update to the service', async () => {
    service.update.mockResolvedValue({ id: 's-1' });

    const result = await controller.update('s-1', { firstName: 'New' });

    expect(service.update).toHaveBeenCalledWith('s-1', { firstName: 'New' });
    expect(result.statusCode).toBe(200);
  });

  it('returns success envelope on delete', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('s-1');

    expect(service.remove).toHaveBeenCalledWith('s-1');
    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'Student deleted. ID: s-1',
    });
  });
});
