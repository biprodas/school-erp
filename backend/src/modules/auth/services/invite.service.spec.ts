import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import type { OrgUserService } from '~/modules/users/services/org-user.service';
import type { MailService } from '~/shared/mail/mail.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import type { AuthTokenRepository } from '../repositories/auth-token.repository';
import { InviteService, temporaryPassword } from './invite.service';

describe('InviteService', () => {
  let orgUsers: { addMember: jest.Mock; activateMembership: jest.Mock };
  let tokens: { saveNew: jest.Mock };
  let mail: { sendActivationEmail: jest.Mock };
  let service: InviteService;

  beforeEach(() => {
    orgUsers = {
      addMember: jest.fn().mockResolvedValue({
        userId: 'u-1',
        createdAccount: true,
        account: { id: 'u-1', email: 'rina@school.test' },
      }),
      activateMembership: jest.fn(),
    };
    tokens = { saveNew: jest.fn() };
    mail = { sendActivationEmail: jest.fn() };
    service = new InviteService(
      orgUsers as unknown as OrgUserService,
      tokens as unknown as AuthTokenRepository,
      mail as unknown as MailService,
      fakeTenantDataSource(),
      { orgId: 'org-a', orgSlug: 'acme' } as never,
    );
  });

  it('emails an activation link and leaves the membership pending', async () => {
    const result = await service.invite({
      name: 'Rina',
      email: 'rina@school.test',
    });

    expect(orgUsers.addMember).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MembershipStatus.PENDING,
        password: undefined,
      }),
    );
    expect(tokens.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        type: AuthTokenType.ACTIVATION,
      }),
    );
    const [to, , rawToken, slug] = mail.sendActivationEmail.mock
      .calls[0] as string[];
    expect([to, slug]).toEqual(['rina@school.test', 'acme']);
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result).toMatchObject({ userId: 'u-1', delivery: 'email' });
  });

  it('returns a one-time slip password for phone-only invites', async () => {
    orgUsers.addMember.mockResolvedValue({
      userId: 'u-2',
      createdAccount: true,
      account: { id: 'u-2', email: null },
    });

    const result = await service.invite({
      name: 'Karim',
      phone: '01712345678',
    });

    const [[input]] = orgUsers.addMember.mock.calls as [
      [{ password: string; status: string }],
    ];
    expect(input.status).toBe(MembershipStatus.ACTIVE);
    expect(result).toEqual({
      userId: 'u-2',
      delivery: 'slip',
      temporaryPassword: input.password,
    });
    expect(mail.sendActivationEmail).not.toHaveBeenCalled();
    expect(tokens.saveNew).not.toHaveBeenCalled();
  });

  it('links an existing account and activates the membership', async () => {
    orgUsers.addMember.mockResolvedValue({
      userId: 'u-3',
      createdAccount: false,
      account: { id: 'u-3', email: 'old@school.test' },
    });

    const result = await service.invite({
      name: 'Old',
      email: 'old@school.test',
    });

    expect(orgUsers.activateMembership).toHaveBeenCalledWith('u-3');
    expect(result).toEqual({ userId: 'u-3', delivery: 'existing_account' });
    expect(mail.sendActivationEmail).not.toHaveBeenCalled();
  });
});

describe('temporaryPassword', () => {
  it('uses only unambiguous characters', () => {
    const pw = temporaryPassword(200);
    expect(pw).toHaveLength(200);
    expect(pw).not.toMatch(/[0O1lI]/);
  });
});
