import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import type { OrgUserService } from '~/modules/users/services/org-user.service';
import type { MailService } from '~/shared/mail/mail.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import type { AuthTokenRepository } from '../repositories/auth-token.repository';
import { InviteService, temporaryPassword } from './invite.service';

describe('InviteService', () => {
  let orgUsers: {
    addMember: jest.Mock;
    activateMembership: jest.Mock;
    addRoles: jest.Mock;
  };
  let tokens: { saveNew: jest.Mock };
  let mail: { sendActivationEmail: jest.Mock };
  let accounts: {
    findByIdentifier: jest.Mock;
    setTemporaryPassword: jest.Mock;
  };
  let members: { findByUserId: jest.Mock };
  let credentials: { hasOwnPassword: jest.Mock };
  let sessions: { revokeAllForUser: jest.Mock };
  let service: InviteService;

  beforeEach(() => {
    orgUsers = {
      addMember: jest.fn().mockResolvedValue({
        userId: 'u-1',
        createdAccount: true,
        account: { id: 'u-1', email: 'rina@school.test' },
      }),
      activateMembership: jest.fn(),
      addRoles: jest.fn(),
    };
    tokens = { saveNew: jest.fn() };
    mail = { sendActivationEmail: jest.fn() };
    accounts = {
      findByIdentifier: jest.fn().mockResolvedValue(null),
      setTemporaryPassword: jest.fn(),
    };
    members = { findByUserId: jest.fn().mockResolvedValue(null) };
    credentials = { hasOwnPassword: jest.fn().mockResolvedValue(false) };
    sessions = { revokeAllForUser: jest.fn() };
    service = new InviteService(
      orgUsers as unknown as OrgUserService,
      tokens as unknown as AuthTokenRepository,
      accounts as never,
      members as never,
      credentials as never,
      sessions as never,
      { record: jest.fn() } as never,
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
  describe('provision (portal accounts)', () => {
    it('makes an active membership and defers the activation email', async () => {
      const result = await service.provision({
        name: 'Rina',
        email: 'rina@school.test',
        portalRole: 'guardian',
        membership: 'active',
      });

      expect(orgUsers.addMember).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MembershipStatus.ACTIVE,
          portalRole: 'guardian',
          password: undefined,
        }),
      );
      expect(mail.sendActivationEmail).not.toHaveBeenCalled();
      await result.sendMail();
      expect(mail.sendActivationEmail).toHaveBeenCalledTimes(1);
    });

    it('gives phone-only people no password until a slip is issued', async () => {
      orgUsers.addMember.mockResolvedValue({
        userId: 'u-3',
        createdAccount: true,
        account: { id: 'u-3', email: null },
      });

      const result = await service.provision({
        name: 'Karim',
        phone: '01712345678',
        portalRole: 'guardian',
        membership: 'active',
        phoneSlip: false,
      });

      expect(result.delivery).toBe('none');
      expect(orgUsers.addMember).toHaveBeenCalledWith(
        expect.objectContaining({ password: undefined }),
      );
    });

    it('adds the role to someone already a member here', async () => {
      accounts.findByIdentifier.mockResolvedValue({ id: 'teacher-1' });
      members.findByUserId.mockResolvedValue({ userId: 'teacher-1' });

      const result = await service.provision({
        name: 'Karim',
        phone: '01712345678',
        portalRole: 'guardian',
        linkExistingMember: true,
      });

      expect(result).toMatchObject({
        userId: 'teacher-1',
        delivery: 'existing_member',
      });
      expect(orgUsers.addRoles).toHaveBeenCalledWith(
        'teacher-1',
        undefined,
        'guardian',
      );
      expect(orgUsers.addMember).not.toHaveBeenCalled();
    });
  });

  describe('issueSlip', () => {
    it('sets a temporary password for a member without their own', async () => {
      members.findByUserId.mockResolvedValue({ userId: 'u-3' });

      const { temporaryPassword: password } = await service.issueSlip('u-3');

      expect(password).toHaveLength(10);
      expect(accounts.setTemporaryPassword).toHaveBeenCalledWith(
        'u-3',
        expect.stringMatching(/^\$2[aby]\$/),
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-3');
    });

    it('refuses once the person chose a password', async () => {
      members.findByUserId.mockResolvedValue({ userId: 'u-3' });
      credentials.hasOwnPassword.mockResolvedValue(true);

      await expect(service.issueSlip('u-3')).rejects.toMatchObject({
        response: { code: 'PASSWORD_ALREADY_SET' },
      });
      expect(accounts.setTemporaryPassword).not.toHaveBeenCalled();
    });
  });
});

describe('temporaryPassword', () => {
  it('uses only unambiguous characters', () => {
    const pw = temporaryPassword(200);
    expect(pw).toHaveLength(200);
    expect(pw).not.toMatch(/[0O1lI]/);
  });
});
