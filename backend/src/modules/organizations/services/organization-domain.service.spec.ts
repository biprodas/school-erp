import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { tenantDomainCache } from '~/tenancy/tenant-slug.cache';
import { OrganizationDomain } from '../entities/organization-domain.entity';
import { DomainStatus } from '../enums/domain-status.enum';
import { OrganizationDomainRepository } from '../repositories/organization-domain.repository';
import { DomainDnsService } from './domain-dns.service';
import { OrganizationDomainService } from './organization-domain.service';

const makeDomain = (overrides: Partial<OrganizationDomain> = {}) =>
  ({
    id: 'dom-1',
    orgId: 'org-test',
    hostname: 'erp.test.edu',
    isPrimary: false,
    status: DomainStatus.PENDING,
    verificationToken: 't'.repeat(64),
    verifiedAt: null,
    lastCheckedAt: null,
    dnsFailingSince: null,
    ...overrides,
  }) as OrganizationDomain;

describe('OrganizationDomainService', () => {
  let repo: Record<string, jest.Mock>;
  let dns: { check: jest.Mock; records: jest.Mock };
  let service: OrganizationDomainService;

  beforeEach(() => {
    repo = {
      findAllOrdered: jest.fn().mockResolvedValue([]),
      findByHostname: jest.fn().mockResolvedValue(null),
      findByIdOrFail: jest.fn().mockResolvedValue(makeDomain()),
      count: jest.fn().mockResolvedValue(0),
      saveNew: jest.fn((data: Partial<OrganizationDomain>) =>
        Promise.resolve(makeDomain(data)),
      ),
      save: jest.fn((d: OrganizationDomain) => Promise.resolve(d)),
      deleteById: jest.fn(),
      clearPrimary: jest.fn(),
    };
    dns = {
      check: jest.fn().mockResolvedValue({ cname: true, txt: true }),
      records: jest.fn().mockReturnValue([{ type: 'CNAME' }]),
    };
    const config = {
      getOrThrow: () => ({ rootDomain: 'mydomain.com', maxPerOrg: 2 }),
    } as unknown as ConfigService;
    service = new OrganizationDomainService(
      repo as unknown as OrganizationDomainRepository,
      dns as unknown as DomainDnsService,
      fakeTenantDataSource(),
      config,
    );
  });

  describe('add', () => {
    it('stores a pending domain with a fresh token and returns its DNS records', async () => {
      const result = await service.add({ hostname: 'ERP.Test.edu' });

      const [[saved]] = repo.saveNew.mock.calls as [[OrganizationDomain]];
      expect(saved.hostname).toBe('erp.test.edu');
      expect(saved.verificationToken).toMatch(/^[0-9a-f]{64}$/);
      expect(result.status).toBe(DomainStatus.PENDING);
      expect(result.dnsRecords).toEqual([{ type: 'CNAME' }]);
    });

    it.each(['mydomain.com', 'acme.mydomain.com'])(
      'rejects %s (under the platform domain)',
      async (hostname) => {
        await expect(service.add({ hostname })).rejects.toThrow(
          BadRequestException,
        );
        expect(repo.saveNew).not.toHaveBeenCalled();
      },
    );

    it('allows a lookalike host that is not under the platform domain', async () => {
      await service.add({ hostname: 'notmydomain.com' });
      expect(repo.saveNew).toHaveBeenCalled();
    });

    it('enforces the per-school limit', async () => {
      repo.count.mockResolvedValue(2);
      await expect(service.add({ hostname: 'erp.test.edu' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a domain the school already added', async () => {
      repo.findByHostname.mockResolvedValue(makeDomain());
      await expect(service.add({ hostname: 'erp.test.edu' })).rejects.toThrow(
        ConflictException,
      );
    });

    it("turns another school's claim (unique violation) into a 409", async () => {
      repo.saveNew.mockRejectedValue(
        new QueryFailedError('INSERT', [], {
          code: '23505',
        } as unknown as Error),
      );
      await expect(service.add({ hostname: 'erp.test.edu' })).rejects.toThrow(
        'This domain is already in use by another school',
      );
    });
  });

  describe('verify', () => {
    it('verifies when both records pass and drops the cached lookup', async () => {
      const invalidate = jest.spyOn(tenantDomainCache, 'invalidate');

      const result = await service.verify('dom-1');

      expect(result.status).toBe(DomainStatus.VERIFIED);
      expect(result.check).toEqual({ cname: true, txt: true });
      expect(repo.save).toHaveBeenCalled();
      expect(invalidate).toHaveBeenCalledWith('erp.test.edu');
      invalidate.mockRestore();
    });

    it('stays pending and reports which record is missing', async () => {
      dns.check.mockResolvedValue({ cname: true, txt: false });
      const result = await service.verify('dom-1');
      expect(result.status).toBe(DomainStatus.PENDING);
      expect(result.check).toEqual({ cname: true, txt: false });
    });

    it("404s for an id that isn't the school's", async () => {
      repo.findByIdOrFail.mockRejectedValue(new NotFoundException());
      await expect(service.verify('other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPrimary', () => {
    it('refuses an unverified domain', async () => {
      await expect(service.setPrimary('dom-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.clearPrimary).not.toHaveBeenCalled();
    });

    it('clears the old primary, then sets the new one', async () => {
      repo.findByIdOrFail.mockResolvedValue(
        makeDomain({ status: DomainStatus.VERIFIED }),
      );

      const result = await service.setPrimary('dom-1');

      expect(repo.clearPrimary).toHaveBeenCalled();
      expect(result.isPrimary).toBe(true);
      expect(repo.clearPrimary.mock.invocationCallOrder[0]).toBeLessThan(
        repo.save.mock.invocationCallOrder[0],
      );
    });
  });

  it('remove deletes the domain and drops the cached lookup', async () => {
    const invalidate = jest.spyOn(tenantDomainCache, 'invalidate');
    await service.remove('dom-1');
    expect(repo.deleteById).toHaveBeenCalledWith('dom-1');
    expect(invalidate).toHaveBeenCalledWith('erp.test.edu');
    invalidate.mockRestore();
  });
});
