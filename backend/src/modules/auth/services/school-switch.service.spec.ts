import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { AppHosts } from '~/shared/hosts/app-hosts';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import type { Membership } from '~/modules/memberships/entities/membership.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import type { PlatformAuthService } from './platform-auth.service';
import { SchoolSwitchService } from './school-switch.service';

const membership = (
  orgId: string,
  name: string,
  status: OrganizationStatus,
  isAdmin = false,
) =>
  ({
    orgId,
    isAdmin,
    organization: { id: orgId, slug: `slug-${orgId}`, name, status },
  }) as unknown as Membership;

describe('SchoolSwitchService', () => {
  let find: jest.Mock;
  let issueHandoff: jest.Mock;
  let service: SchoolSwitchService;

  beforeEach(() => {
    find = jest.fn();
    issueHandoff = jest.fn();
    const hosts = new AppHosts({
      get: (key: string) =>
        key === 'domains'
          ? { rootDomain: 'lvh.me' }
          : { appUrl: 'http://localhost:3000' },
    } as unknown as ConfigService);
    service = new SchoolSwitchService(
      { find } as unknown as Repository<Membership>,
      { issueHandoff } as unknown as PlatformAuthService,
      hosts,
      { orgId: 'org-current' } as RequestWithOrg,
    );
  });

  it("lists the user's other operational schools by name, with their hosts", async () => {
    find.mockResolvedValue([
      membership('org-b', 'Zila School', OrganizationStatus.ACTIVE),
      membership('org-c', 'Adarsha School', OrganizationStatus.TRIAL, true),
      membership('org-d', 'Closed School', OrganizationStatus.SUSPENDED),
    ]);

    await expect(service.otherSchools('user-1')).resolves.toEqual([
      {
        orgId: 'org-c',
        slug: 'slug-org-c',
        name: 'Adarsha School',
        host: 'slug-org-c.lvh.me',
        isAdmin: true,
      },
      {
        orgId: 'org-b',
        slug: 'slug-org-b',
        name: 'Zila School',
        host: 'slug-org-b.lvh.me',
        isAdmin: false,
      },
    ]);
    // Only the user's active memberships outside this school are read.
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: 'active',
        }) as unknown,
      }),
    );
  });

  it('issues a code and the URL that redeems it on the other host', async () => {
    const expiresAt = new Date('2026-10-24T10:01:00Z');
    issueHandoff.mockResolvedValue({
      code: 'a b',
      orgSlug: 'zila',
      expiresAt,
    });

    await expect(service.handoff('user-1', 'org-b')).resolves.toEqual({
      orgId: 'org-b',
      expiresAt,
      redirectUrl: 'http://zila.lvh.me:3000/auth/handoff?code=a%20b',
    });
    expect(issueHandoff).toHaveBeenCalledWith('user-1', 'org-b');
  });

  it('refuses the school the user is already in', async () => {
    await expect(service.handoff('user-1', 'org-current')).rejects.toThrow(
      BadRequestException,
    );
    expect(issueHandoff).not.toHaveBeenCalled();
  });

  it("passes on the issuer's refusal for a school the user can't enter", async () => {
    issueHandoff.mockRejectedValue(new ForbiddenException());

    await expect(service.handoff('user-1', 'org-x')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
