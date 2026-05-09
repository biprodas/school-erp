import { registerAs } from '@nestjs/config';

const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
}));

export type JwtConfig = ReturnType<typeof jwtConfig>;
export default jwtConfig;
