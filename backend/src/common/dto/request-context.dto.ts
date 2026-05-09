import { UserDto } from "src/modules/platform/users/dto/user.dto";

export class RequestContextDto {
  public requestId: string;

  public ip: string;
  // public clientIp: string;

  public protocol: string;
  public host: string;
  public url: string;

  public tenantId: string | null;
  public userId: string | null;
  public user: UserDto | null;
}