import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SignupTicketService } from './signup-ticket.service';

const SECRET = 'unit-test-secret-at-least-32-characters';

describe('SignupTicketService', () => {
  const service = new SignupTicketService({
    get: () => SECRET,
  } as unknown as ConfigService);

  it('round-trips what Google verified, with a normalized email', () => {
    const ticket = service.issue({
      email: ' Owner@Example.COM ',
      name: 'Owner',
      sub: 'g-1',
    });
    expect(service.verify(ticket)).toEqual({
      email: 'owner@example.com',
      name: 'Owner',
      sub: 'g-1',
    });
  });

  it('refuses tampered tickets and access tokens signed with the app secret', () => {
    const ticket = service.issue({ email: 'a@b.com', name: '', sub: 'g' });
    expect(() => service.verify(`${ticket}x`)).toThrow();
    const accessLike = new JwtService({ secret: SECRET }).sign({
      typ: 'signup_google',
      email: 'a@b.com',
      gsub: 'g',
    });
    expect(() => service.verify(accessLike)).toThrow();
  });
});
