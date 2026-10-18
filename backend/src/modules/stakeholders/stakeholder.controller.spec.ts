import { StakeholderController } from './stakeholder.controller';
import { StakeholderService } from './stakeholder.service';
import { StakeholderType } from './enums/stakeholder-type.enum';

// The response envelope is added by ResponseEnvelopeInterceptor (see its
// spec); handlers only delegate to the service and return its result.
describe('StakeholderController', () => {
  let controller: StakeholderController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      findFiltered: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new StakeholderController(
      service as unknown as StakeholderService,
    );
  });

  it('passes the filter to the service on findAll', async () => {
    service.findFiltered.mockResolvedValue([{ id: 'k-1' }]);

    const result = await controller.findAll({ type: StakeholderType.VENDOR });

    expect(service.findFiltered).toHaveBeenCalledWith({
      type: StakeholderType.VENDOR,
    });
    expect(result).toEqual([{ id: 'k-1' }]);
  });

  it('returns the created entity', async () => {
    service.create.mockResolvedValue({ id: 'k-new' });
    const dto = { name: 'Acme', type: StakeholderType.VENDOR };

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'k-new' });
  });

  it('delegates remove to the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('k-1');

    expect(service.remove).toHaveBeenCalledWith('k-1');
  });
});
