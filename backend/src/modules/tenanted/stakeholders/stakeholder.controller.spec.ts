import { StakeholderController } from './stakeholder.controller';
import { StakeholderService } from './stakeholder.service';
import { StakeholderType } from './enums/stakeholder-type.enum';

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

  it('wraps findAll in the standard response envelope', async () => {
    service.findFiltered.mockResolvedValue([{ id: 'k-1' }]);

    const result = await controller.findAll({ type: StakeholderType.VENDOR });

    expect(service.findFiltered).toHaveBeenCalledWith({
      type: StakeholderType.VENDOR,
    });
    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'List of stakeholders',
      data: [{ id: 'k-1' }],
    });
  });

  it('returns 201 envelope on create', async () => {
    service.create.mockResolvedValue({ id: 'k-new' });

    const result = await controller.create({
      name: 'Acme',
      type: StakeholderType.VENDOR,
    });

    expect(result.statusCode).toBe(201);
    expect(result.data).toEqual({ id: 'k-new' });
    expect(result.message).toContain('k-new');
  });

  it('returns success envelope on delete', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('k-1');

    expect(service.remove).toHaveBeenCalledWith('k-1');
    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'Stakeholder deleted. ID: k-1',
    });
  });
});
