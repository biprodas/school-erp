import { BadRequestException, ConflictException } from '@nestjs/common';
import { ShiftRepository } from './shift.repository';
import { ShiftService } from './shift.service';
import { Shift } from './entities/shift.entity';

describe('ShiftService', () => {
  let service: ShiftService;
  let repo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByName: jest.fn().mockResolvedValue(null),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data: Partial<Shift>) => Promise.resolve(data)),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    service = new ShiftService(repo as unknown as ShiftRepository);
  });

  it('stores times as HH:mm:ss', async () => {
    await service.create({
      name: 'Morning',
      startTime: '07:30',
      endTime: '12:00',
    });

    expect(repo.saveNew).toHaveBeenCalledWith({
      name: 'Morning',
      startTime: '07:30:00',
      endTime: '12:00:00',
      sortOrder: 0,
    });
  });

  it('rejects a shift that ends before it starts, also on update', async () => {
    await expect(
      service.create({ name: 'Day', startTime: '13:00', endTime: '12:00' }),
    ).rejects.toThrow(BadRequestException);

    repo.findByIdOrFail.mockResolvedValue({
      id: 's1',
      name: 'Day',
      startTime: '12:30:00',
      endTime: '17:00:00',
    });
    await expect(service.update('s1', { endTime: '12:00' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a duplicate name', async () => {
    repo.findByName.mockResolvedValue({ id: 'other' });

    await expect(
      service.create({ name: 'Morning', startTime: '07:00', endTime: '12:00' }),
    ).rejects.toThrow(ConflictException);
  });
});
