import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '~/modules/users/entities/user.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { OrganizationDomain } from '~/modules/organizations/entities/organization-domain.entity';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { UserModule } from '~/modules/users/user.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { OrganizationModule } from '~/modules/organizations/organization.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { SubjectGroupModule } from '~/modules/subject-groups/subject-group.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { StudentModule } from '~/modules/students/student.module';
import { OnboardingController } from './controllers/onboarding.controller';
import { PublicFindSchoolController } from './controllers/public-find-school.controller';
import { OnboardingService } from './services/onboarding.service';
import { CurriculumTemplateService } from './services/curriculum-template.service';
import { FindSchoolService } from './services/find-school.service';

/**
 * Onboarding (PRD 6.2): the setup checklist, setup templates and the public
 * "Find your school" request.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Membership, OrganizationDomain]),
    RbacModule,
    UserModule,
    SettingsModule,
    OrganizationModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    SubjectModule,
    SubjectGroupModule,
    ClassCurriculumModule,
    EmployeeModule,
    StudentModule,
  ],
  controllers: [OnboardingController, PublicFindSchoolController],
  providers: [OnboardingService, CurriculumTemplateService, FindSchoolService],
})
export class OnboardingModule {}
