import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AppHosts } from '~/shared/hosts/app-hosts';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { isOperationalOrganization } from '~/modules/organizations/enums/organization-status.enum';
import { PlatformAuthService } from './platform-auth.service';

/** One of the user's other schools, as the school switcher lists it. */
export interface OtherSchool {
  orgId: string;
  slug: string;
  name: string;
  host: string;
  isAdmin: boolean;
}

/**
 * Moving between the schools of one account without signing in again
 * (doc/domains-and-routing.md 5): a teacher at two schools, or a guardian
 * with children at two. Session cookies are per host, so the switch is a
 * one-time handoff code redeemed on the other school's host.
 *
 * Memberships of other schools are read through the root connection (the
 * request's RLS context only sees this school), always filtered by user.
 */
@Injectable()
export class SchoolSwitchService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly platformAuth: PlatformAuthService,
    private readonly hosts: AppHosts,
    @Inject(REQUEST) private readonly request: RequestWithOrg,
  ) {}

  /** Active memberships in the user's other operational schools, by name. */
  async otherSchools(userId: string): Promise<OtherSchool[]> {
    const rows = await this.memberships.find({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        orgId: Not(this.request.orgId!),
      },
      relations: { organization: true },
    });
    return rows
      .filter((m) => isOperationalOrganization(m.organization.status))
      .map((m) => ({
        orgId: m.orgId,
        slug: m.organization.slug,
        name: m.organization.name,
        host: this.hosts.schoolHost(m.organization.slug),
        isAdmin: m.isAdmin === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * A one-time code (60 s) for another of the user's schools, and the URL
   * that redeems it there. The handoff page decides where the user lands.
   * Refused (403) unless the account, the school and the membership are all
   * active, with the same answer in every case.
   */
  async handoff(userId: string, orgId: string) {
    if (orgId === this.request.orgId) {
      throw new BadRequestException({
        message: 'You are already signed in to this school',
        code: 'ALREADY_IN_SCHOOL',
      });
    }
    const issued = await this.platformAuth.issueHandoff(userId, orgId);
    return {
      orgId,
      expiresAt: issued.expiresAt,
      redirectUrl: this.hosts.url(
        this.hosts.schoolHost(issued.orgSlug),
        `/auth/handoff?code=${encodeURIComponent(issued.code)}`,
      ),
    };
  }
}
