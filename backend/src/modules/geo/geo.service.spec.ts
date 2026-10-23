import { BadRequestException } from '@nestjs/common';
import {
  BD_DISTRICTS,
  BD_DIVISIONS,
  BD_UPAZILAS,
} from '~/shared/geo/bd-geo.data';
import { GeoService } from './geo.service';

describe('GeoService', () => {
  const geo = new GeoService();
  const [upazilaId, parent] = BD_UPAZILAS[0];
  const districtId = parent!;
  const divisionId = BD_DISTRICTS.find(([id]) => id === districtId)![1]!;

  it('has the 8 divisions, 64 districts and every upazila', () => {
    expect(BD_DIVISIONS).toHaveLength(8);
    expect(BD_DISTRICTS).toHaveLength(64);
    expect(BD_UPAZILAS.length).toBeGreaterThan(490);
    expect(new Set(BD_UPAZILAS.map(([id]) => id)).size).toBe(
      BD_UPAZILAS.length,
    );
  });

  it('lists children of a unit', () => {
    expect(geo.districts(divisionId).map((d) => d.id)).toContain(districtId);
    expect(geo.upazilas(districtId).map((u) => u.id)).toContain(upazilaId);
  });

  it('fills the parents from an upazila', () => {
    expect(geo.resolve({ upazilaId })).toEqual({
      upazilaId,
      districtId,
      divisionId,
    });
  });

  it('rejects units that disagree or do not exist', () => {
    const otherDistrict = BD_DISTRICTS.find(([id]) => id !== districtId)![0];
    expect(() => geo.resolve({ upazilaId, districtId: otherDistrict })).toThrow(
      BadRequestException,
    );
    expect(() => geo.resolve({ districtId: 9999 })).toThrow(
      BadRequestException,
    );
    expect(geo.resolve({})).toEqual({
      divisionId: null,
      districtId: null,
      upazilaId: null,
    });
  });
});
