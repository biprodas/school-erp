import { LoginDto } from './login.dto';

/** Same shape as the tenant login: identifier (or legacy email) + password. */
export class PlatformLoginDto extends LoginDto {}
