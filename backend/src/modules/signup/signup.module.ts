import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '~/modules/auth/auth.module';
import { OrganizationModule } from '~/modules/organizations/organization.module';
import { UserIdentity } from '~/modules/auth/entities/user-identity.entity';
import { User } from '~/modules/users/entities/user.entity';
import { SignupRequest } from './entities/signup-request.entity';
import { PublicSignupController } from './controllers/public-signup.controller';
import { SignupService } from './services/signup.service';
import { SignupTicketService } from './services/signup-ticket.service';

/** Self-serve school signup (PRD 6.2, 7.1). */
@Module({
  imports: [
    TypeOrmModule.forFeature([SignupRequest, User, UserIdentity]),
    AuthModule,
    OrganizationModule,
  ],
  controllers: [PublicSignupController],
  providers: [SignupService, SignupTicketService],
  exports: [SignupTicketService],
})
export class SignupModule {}
