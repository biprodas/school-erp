import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeStatus } from './enums/employee-status.enum';

describe('EmployeeController', () => {
  let controller: EmployeeController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      findFiltered: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new EmployeeController(service as unknown as EmployeeService);
  });

  it('wraps findAll in the standard response envelope', async () => {
    service.findFiltered.mockResolvedValue([{ id: 'e-1' }]);

    const result = await controller.findAll({
      status: EmployeeStatus.ACTIVE,
    });

    expect(service.findFiltered).toHaveBeenCalledWith({
      status: EmployeeStatus.ACTIVE,
    });
    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'List of employees',
      data: [{ id: 'e-1' }],
    });
  });

  it('returns 201 envelope on create', async () => {
    service.create.mockResolvedValue({ id: 'e-new' });

    const result = await controller.create({
      employeeNumber: 'EMP-100',
      firstName: 'A',
      lastName: 'B',
    });

    expect(result.statusCode).toBe(201);
    expect(result.data).toEqual({ id: 'e-new' });
    expect(result.message).toContain('e-new');
  });

  it('delegates findOne to the service', async () => {
    service.findById.mockResolvedValue({ id: 'e-1' });

    const result = await controller.findOne('e-1');

    expect(service.findById).toHaveBeenCalledWith('e-1');
    expect(result.data).toEqual({ id: 'e-1' });
  });

  it('delegates update to the service', async () => {
    service.update.mockResolvedValue({ id: 'e-1' });

    const result = await controller.update('e-1', { firstName: 'New' });

    expect(service.update).toHaveBeenCalledWith('e-1', { firstName: 'New' });
    expect(result.statusCode).toBe(200);
  });

  it('returns success envelope on delete', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('e-1');

    expect(service.remove).toHaveBeenCalledWith('e-1');
    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'Employee deleted. ID: e-1',
    });
  });
});
