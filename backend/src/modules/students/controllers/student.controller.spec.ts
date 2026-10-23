import { StudentController } from './student.controller';
import { StudentService } from '../services/student.service';
import { StudentStatus } from '../enums/student-status.enum';

// The response envelope is added by ResponseEnvelopeInterceptor (see its
// spec); handlers only delegate to the service and return its result.
describe('StudentController', () => {
  let controller: StudentController;
  let service: Record<string, jest.Mock>;
  let scope: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      findFiltered: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      photoUrl: jest.fn().mockResolvedValue(null),
    };
    scope = {
      sections: jest.fn().mockResolvedValue(null),
      assert: jest.fn().mockResolvedValue(undefined),
    };
    controller = new StudentController(
      service as unknown as StudentService,
      scope as never,
      { start: jest.fn() } as never,
    );
  });

  it('passes the filter and the caller scope to the service on findAll', async () => {
    service.findFiltered.mockResolvedValue([{ id: 's-1' }]);
    scope.sections.mockResolvedValue(['sec-1']);

    const result = await controller.findAll({ status: StudentStatus.ACTIVE });

    expect(service.findFiltered).toHaveBeenCalledWith(
      { status: StudentStatus.ACTIVE },
      ['sec-1'],
    );
    expect(result).toEqual([{ id: 's-1' }]);
  });

  it('returns the created entity', async () => {
    service.create.mockResolvedValue({ id: 's-new' });
    const dto = {
      firstName: 'A',
      lastName: 'B',
    };

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 's-new' });
  });

  it('checks scope, then returns the student with a photo URL', async () => {
    service.findById.mockResolvedValue({ id: 's-1' });

    const result = await controller.findOne('s-1');

    expect(scope.assert).toHaveBeenCalledWith('students:read', 's-1');
    expect(result).toEqual({ id: 's-1', photoUrl: null });
  });

  it('delegates update to the service', async () => {
    service.update.mockResolvedValue({ id: 's-1' });

    const result = await controller.update('s-1', { firstName: 'New' });

    expect(service.update).toHaveBeenCalledWith('s-1', { firstName: 'New' });
    expect(result).toEqual({ id: 's-1' });
  });

  it('delegates remove to the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('s-1');

    expect(service.remove).toHaveBeenCalledWith('s-1');
  });
});
