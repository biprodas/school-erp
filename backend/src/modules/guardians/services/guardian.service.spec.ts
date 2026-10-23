import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { GuardianRepository } from '../repositories/guardian.repository';
import { StudentGuardianRepository } from '../repositories/student-guardian.repository';
import { GuardianService } from './guardian.service';
import { Guardian } from '../entities/guardian.entity';
import { StudentGuardian } from '../entities/student-guardian.entity';
import { GuardianRelation } from '../enums/guardian-relation.enum';

const makeGuardian = (overrides: Partial<Guardian> = {}): Guardian => ({
  id: 'g-1',
  orgId: 'org-1',
  name: 'Jane Doe',
  nameBn: null,
  phone: null,
  email: null,
  address: null,
  occupation: null,
  income: null,
  nid: null,
  userId: null,
  links: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeLink = (overrides: Partial<StudentGuardian> = {}): StudentGuardian =>
  ({
    id: 'link-1',
    studentId: 'stu-1',
    guardianId: 'g-1',
    relation: GuardianRelation.MOTHER,
    isPrimary: false,
    isEmergency: false,
    createdAt: new Date(),
    ...overrides,
  }) as StudentGuardian;

describe('GuardianService', () => {
  let service: GuardianService;
  let guardianRepo: Record<string, jest.Mock>;
  let linkRepo: Record<string, jest.Mock>;
  let invites: { provision: jest.Mock; issueSlip: jest.Mock };
  let sendMail: jest.Mock;
  let students: { findById: jest.Mock };

  beforeEach(() => {
    guardianRepo = {
      findByIdWithUser: jest.fn((id: string) =>
        Promise.resolve(makeGuardian({ id })),
      ),
      findByPhone: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn(),
      findFiltered: jest.fn(),
      findInSections: jest.fn(),
      saveNew: jest.fn((data: Partial<Guardian>) =>
        Promise.resolve(makeGuardian({ id: 'new-g', ...data })),
      ),
      updateFields: jest.fn(),
      deleteById: jest.fn(),
    };
    linkRepo = {
      findByStudent: jest.fn(),
      findLink: jest.fn().mockResolvedValue(null),
      findByIdOrFail: jest.fn((id: string) =>
        Promise.resolve(makeLink({ id })),
      ),
      saveNew: jest.fn((data: Partial<StudentGuardian>) =>
        Promise.resolve(makeLink({ id: 'new-link', ...data })),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
      clearPrimary: jest.fn(),
      deleteById: jest.fn(),
      deleteByGuardian: jest.fn(),
    };
    sendMail = jest.fn();
    invites = {
      provision: jest
        .fn()
        .mockResolvedValue({ userId: 'u-1', delivery: 'email', sendMail }),
      issueSlip: jest.fn().mockResolvedValue({ temporaryPassword: 'abc' }),
    };
    students = { findById: jest.fn().mockResolvedValue({ id: 'stu-1' }) };

    service = new GuardianService(
      guardianRepo as unknown as GuardianRepository,
      linkRepo as unknown as StudentGuardianRepository,
      invites as never,
      students as never,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it('gives the guardian a portal login and mails after saving', async () => {
      await service.create({
        name: 'Jane',
        phone: '017-1234-5678',
        email: 'jane@example.com',
      });

      expect(invites.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane@example.com',
          phone: '+8801712345678',
          portalRole: 'guardian',
          membership: 'active',
          linkExistingMember: true,
        }),
      );
      expect(guardianRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+8801712345678', userId: 'u-1' }),
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('refuses a phone another guardian already has', async () => {
      guardianRepo.findByPhone.mockResolvedValue(makeGuardian());

      await expect(
        service.create({ name: 'Jane', phone: '01712345678' }),
      ).rejects.toMatchObject({ response: { code: 'GUARDIAN_PHONE_TAKEN' } });
      expect(invites.provision).not.toHaveBeenCalled();
    });

    it('rejects an invalid phone', async () => {
      await expect(
        service.create({ name: 'Jane', phone: '12' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOrProvision', () => {
    it('returns the existing guardian with the phone', async () => {
      guardianRepo.findByPhone.mockResolvedValue(makeGuardian({ id: 'old' }));

      const made = await service.findOrProvision({
        name: 'Other spelling',
        phone: '01712345678',
      });

      expect(made).toMatchObject({ created: false, account: null });
      expect(made.guardian.id).toBe('old');
      expect(guardianRepo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('attach', () => {
    it('links an existing guardian, taking over the primary flag', async () => {
      await service.attach('stu-1', {
        guardianId: 'g-1',
        relation: GuardianRelation.MOTHER,
        isPrimary: true,
      });

      expect(linkRepo.clearPrimary).toHaveBeenCalledWith('stu-1');
      expect(linkRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu-1',
          guardianId: 'g-1',
          isPrimary: true,
        }),
      );
    });

    it('creates the guardian inline (or links the one with that phone)', async () => {
      await service.attach('stu-1', {
        createGuardian: { name: 'New', phone: '01812345678' },
        relation: GuardianRelation.FATHER,
      });

      expect(guardianRepo.saveNew).toHaveBeenCalled();
      expect(sendMail).toHaveBeenCalled();
    });

    it('rejects a guardian already linked', async () => {
      linkRepo.findLink.mockResolvedValue(makeLink());

      await expect(
        service.attach('stu-1', {
          guardianId: 'g-1',
          relation: GuardianRelation.MOTHER,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('needs exactly one of guardianId and createGuardian', async () => {
      await expect(
        service.attach('stu-1', { relation: GuardianRelation.OTHER }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('portalSlip', () => {
    it('issues a slip for the guardian login', async () => {
      guardianRepo.findByIdWithUser.mockResolvedValue(
        makeGuardian({ userId: 'u-1' }),
      );

      await expect(service.portalSlip('g-1')).resolves.toEqual({
        temporaryPassword: 'abc',
      });
      expect(invites.issueSlip).toHaveBeenCalledWith('u-1');
    });

    it('404s without a login', async () => {
      await expect(service.portalSlip('g-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('scopes the list to a teacher’s sections', async () => {
    await service.findFiltered({}, ['sec-1']);

    expect(guardianRepo.findInSections).toHaveBeenCalledWith({}, ['sec-1']);
    expect(guardianRepo.findFiltered).not.toHaveBeenCalled();
  });
});
