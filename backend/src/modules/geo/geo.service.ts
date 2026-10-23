import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BD_DISTRICTS,
  BD_DIVISIONS,
  BD_UPAZILAS,
  type GeoRow,
} from '~/shared/geo/bd-geo.data';

export interface GeoUnit {
  id: number;
  name: string;
  nameBn: string;
}

/** Division / district / upazila ids of an address; any may be missing. */
export interface GeoRef {
  divisionId?: number | null;
  districtId?: number | null;
  upazilaId?: number | null;
}

const unit = ([id, , name, nameBn]: GeoRow): GeoUnit => ({ id, name, nameBn });
const parentOf = (rows: readonly GeoRow[]) =>
  new Map(rows.map(([id, parent]) => [id, parent]));

const DISTRICT_PARENT = parentOf(BD_DISTRICTS);
const UPAZILA_PARENT = parentOf(BD_UPAZILAS);
const DIVISION_IDS = new Set(BD_DIVISIONS.map(([id]) => id));

/**
 * Bangladesh administrative units for address pickers (PRD 6.6). Served
 * from the code-defined seed data, which the `geo_*` tables mirror so
 * addresses can reference them; nothing per school.
 */
@Injectable()
export class GeoService {
  divisions(): GeoUnit[] {
    return BD_DIVISIONS.map(unit);
  }

  districts(divisionId?: number): GeoUnit[] {
    return BD_DISTRICTS.filter(
      ([, parent]) => divisionId === undefined || parent === divisionId,
    ).map(unit);
  }

  upazilas(districtId?: number): GeoUnit[] {
    return BD_UPAZILAS.filter(
      ([, parent]) => districtId === undefined || parent === districtId,
    ).map(unit);
  }

  /**
   * Completes and checks an address's units: a district implies its
   * division, an upazila its district. Throws when they disagree.
   */
  resolve(ref: GeoRef): Required<GeoRef> {
    let { divisionId = null, districtId = null } = ref;
    const upazilaId = ref.upazilaId ?? null;
    if (upazilaId !== null) {
      const district = UPAZILA_PARENT.get(upazilaId);
      if (district === undefined) throw invalid('Unknown upazila');
      if (districtId !== null && districtId !== district) {
        throw invalid('The upazila is not in that district');
      }
      districtId = district;
    }
    if (districtId !== null) {
      const division = DISTRICT_PARENT.get(districtId);
      if (division === undefined) throw invalid('Unknown district');
      if (divisionId !== null && divisionId !== division) {
        throw invalid('The district is not in that division');
      }
      divisionId = division;
    }
    if (divisionId !== null && !DIVISION_IDS.has(divisionId)) {
      throw invalid('Unknown division');
    }
    return { divisionId, districtId, upazilaId };
  }
}

const invalid = (message: string) =>
  new BadRequestException({ message, code: 'INVALID_GEO' });
