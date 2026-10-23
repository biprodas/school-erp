import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeStatus } from './enums/employee-status.enum';

// The response envelope is added by ResponseEnvelopeInterceptor (see its
// spec); handlers only delegate to the service and return its result.
describe('EmployeeController', () => {
  let controller: EmployeeController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      findFiltered: jest.fn(),
      findOneView: jest.fn(),
      invite: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new EmployeeController(service as unknown as EmployeeService);
  });

  it('passes the filter to the service on findAll', async () => {
    service.findFiltered.mockResolvedValue([{ id: 'e-1' }]);

    const result = await controller.findAll({ status: EmployeeStatus.ACTIVE });

    expect(service.findFiltered).toHaveBeenCalledWith({
      status: EmployeeStatus.ACTIVE,
    });
    expect(result).toEqual([{ id: 'e-1' }]);
  });

  it('returns the created entity', async () => {
    service.create.mockResolvedValue({ id: 'e-new' });
    const dto = {
      employeeNumber: 'EMP-100',
      firstName: 'A',
      lastName: 'B',
    };

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'e-new' });
  });

  it('delegates findOne to the service (with the photo URL)', async () => {
    service.findOneView.mockResolvedValue({ id: 'e-1', photoUrl: null });

    const result = await controller.findOne('e-1');

    expect(service.findOneView).toHaveBeenCalledWith('e-1');
    expect(result).toEqual({ id: 'e-1', photoUrl: null });
  });

  it('delegates invite to the service', async () => {
    service.invite.mockResolvedValue({ userId: 'u-1', delivery: 'email' });

    const result = await controller.invite('e-1', { roleIds: ['r-1'] });

    expect(service.invite).toHaveBeenCalledWith('e-1', { roleIds: ['r-1'] });
    expect(result).toEqual({ userId: 'u-1', delivery: 'email' });
  });

  it('requires a file for the photo upload', () => {
    expect(() => controller.uploadPhoto('e-1', undefined)).toThrow(
      'multipart field',
    );
  });

  it('delegates update to the service', async () => {
    service.update.mockResolvedValue({ id: 'e-1' });

    const result = await controller.update('e-1', { firstName: 'New' });

    expect(service.update).toHaveBeenCalledWith('e-1', { firstName: 'New' });
    expect(result).toEqual({ id: 'e-1' });
  });

  it('delegates remove to the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('e-1');

    expect(service.remove).toHaveBeenCalledWith('e-1');
  });
});
