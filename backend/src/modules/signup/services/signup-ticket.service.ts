import { createHmac } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { normalizeEmail } from '~/common/identity/identifier';

/** What Google proved at a signup sign-in. */
export interface GoogleSignupClaims {
  email: string;
  name: string;
  /** Google's subject id, linked to the owner's account on signup. */
  sub: string;
}

const TICKET_TTL = '30m';
const TICKET_TYPE = 'signup_google';

/**
 * Short-lived, signed proof that Google verified an email, handed from the
 * Google callback to the signup form (doc/domains-and-routing.md 5a, step 3).
 * Signed with a key derived from `JWT_SECRET`, so it can never pass as an
 * access token, and vice versa.
 */
@Injectable()
export class SignupTicketService {
  private readonly jwt: JwtService;

  constructor(config: ConfigService) {
    const secret = createHmac('sha256', config.get<string>('jwt.secret')!)
      .update('signup-ticket')
      .digest('hex');
    this.jwt = new JwtService({ secret });
  }

  issue(claims: GoogleSignupClaims): string {
    return this.jwt.sign(
      {
        typ: TICKET_TYPE,
        email: normalizeEmail(claims.email),
        name: claims.name,
        gsub: claims.sub,
      },
      { expiresIn: TICKET_TTL },
    );
  }

  /** Throws 400 `INVALID_GOOGLE_TICKET` for a bad or expired ticket. */
  verify(ticket: string): GoogleSignupClaims {
    try {
      const payload = this.jwt.verify<{
        typ?: string;
        email?: string;
        name?: string;
        gsub?: string;
      }>(ticket);
      if (payload.typ === TICKET_TYPE && payload.email && payload.gsub) {
        return {
          email: payload.email,
          name: payload.name ?? '',
          sub: payload.gsub,
        };
      }
    } catch {
      // Same answer as a malformed ticket.
    }
    throw new BadRequestException({
      message: 'Your Google sign-in has expired. Please try again.',
      code: 'INVALID_GOOGLE_TICKET',
    });
  }
}
