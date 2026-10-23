import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M1, platform admin and onboarding (backend plan 5):
 *
 * - `plans`, seeded with Free/Basic/Standard/Premium (frozen copy of
 *   `plans.catalog.ts`); `organizations.plan_id` gets its FK, plus
 *   `add_on_modules` and `limit_overrides`. Existing schools go on Standard,
 *   so nothing they use today (custom domains, custom roles) is gated.
 * - Slugs: every slug that breaks the new rule (`_`, length, edges) is
 *   rewritten, and its old value goes to `organization_slug_history`, where
 *   it redirects for 12 months.
 * - `signup_requests` (self-serve signup), `user_identities` and
 *   `oauth_states` (Google sign-in), `users.password_set`.
 * - Existing schools count as onboarded; the `admin` system role gets
 *   `onboarding:manage`.
 *
 * All new tables are platform or identity tables: no `org_id` RLS policy and
 * no app-role grant (the root connection reads them).
 */
export class PlatformAndOnboarding1792340000000 implements MigrationInterface {
  name = 'PlatformAndOnboarding1792340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Plans -----------------------------------------------------------
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(32) NOT NULL, "name" character varying(80) NOT NULL, "price_per_student" bigint NOT NULL DEFAULT '0', "min_fee" bigint NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'BDT', "modules" text array NOT NULL DEFAULT '{}', "limits" jsonb NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_95f7ef3fc4c31a3545b4d825dd4" UNIQUE ("code"), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    for (const plan of PLANS) {
      await queryRunner.query(
        `INSERT INTO "plans" ("code", "name", "price_per_student", "min_fee", "modules", "limits", "sort_order")
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT ("code") DO NOTHING`,
        [
          plan.code,
          plan.name,
          plan.pricePerStudent,
          plan.minFee,
          plan.modules,
          JSON.stringify(plan.limits),
          plan.sortOrder,
        ],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "add_on_modules" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "limit_overrides" jsonb`,
    );
    // `plan_id` existed without a target until now; drop stray values.
    await queryRunner.query(
      `UPDATE "organizations" SET "plan_id" = NULL
       WHERE "plan_id" IS NOT NULL AND "plan_id" NOT IN (SELECT "id" FROM "plans")`,
    );
    await queryRunner.query(
      `UPDATE "organizations" SET "plan_id" = (SELECT "id" FROM "plans" WHERE "code" = 'standard')
       WHERE "plan_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "FK_5af9084f0be89dc2db47754aa18" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // --- Slugs -----------------------------------------------------------
    await queryRunner.query(
      `CREATE TABLE "organization_slug_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "slug" character varying(63) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_98402a45ac0713f764cc56f50df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7dde1177acdb0dee26b772a4f3" ON "organization_slug_history" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_organization_slug_history_slug" ON "organization_slug_history" ("slug") `,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_slug_history" ADD CONSTRAINT "FK_7dde1177acdb0dee26b772a4f37" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.rewriteSlugs(queryRunner);

    // --- Signup ----------------------------------------------------------
    await queryRunner.query(
      `CREATE TABLE "signup_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "school_name" character varying(100) NOT NULL, "type" character varying(32) NOT NULL, "slug" character varying(63) NOT NULL, "owner_name" character varying(100) NOT NULL, "email" character varying NOT NULL, "phone" character varying(16), "password_hash" character varying, "token_hash" character varying(64), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, "org_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f3de75c74453a667ae434d6a1a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b3485888ca8dff7ec65a9dcb0" ON "signup_requests" ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_signup_requests_token_hash" ON "signup_requests" ("token_hash") `,
    );

    // --- Google sign-in --------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_set" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" character varying(32) NOT NULL, "subject" character varying(255) NOT NULL, "email" character varying, "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e23bff04e9c3e7b785e442b262c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_identities_user_provider" ON "user_identities" ("user_id", "provider") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_identities_provider_subject" ON "user_identities" ("provider", "subject") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_identities" ADD CONSTRAINT "FK_bf5fe01eb8cad7114b4c371cdc7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "state_hash" character varying(64) NOT NULL, "code_verifier" character varying(128) NOT NULL, "nonce" character varying(64) NOT NULL, "return_host" character varying(255) NOT NULL, "org_id" uuid, "next" character varying(512) NOT NULL DEFAULT '/', "intent" character varying(16) NOT NULL, "user_id" uuid, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c9df6e4203e8ca042bfe5bd00ec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_oauth_states_hash" ON "oauth_states" ("state_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_570fe1df341197ba96a80b1bbc" ON "oauth_states" ("expires_at") `,
    );

    // --- Onboarding ------------------------------------------------------
    // Schools that exist already were set up before the wizard existed.
    await queryRunner.query(
      `UPDATE "organizations" SET "onboarding_completed_at" = now()
       WHERE "onboarding_completed_at" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_append("permissions", 'onboarding:manage'), "updated_at" = now()
       WHERE "is_system" AND "name" = 'admin' AND NOT ('onboarding:manage' = ANY("permissions"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_remove("permissions", 'onboarding:manage')`,
    );
    await queryRunner.query(`DROP TABLE "oauth_states"`);
    await queryRunner.query(`DROP TABLE "user_identities"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_set"`);
    await queryRunner.query(`DROP TABLE "signup_requests"`);
    // Rewritten slugs keep their new form (the old rule allowed them too).
    await queryRunner.query(`DROP TABLE "organization_slug_history"`);
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "FK_5af9084f0be89dc2db47754aa18"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN "limit_overrides"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN "add_on_modules"`,
    );
    await queryRunner.query(`UPDATE "organizations" SET "plan_id" = NULL`);
    await queryRunner.query(`DROP TABLE "plans"`);
  }

  /**
   * `acme_school` → `acme-school` (collisions get `-2`, `-3`, …); the old
   * slug redirects for 12 months.
   */
  private async rewriteSlugs(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "slug" FROM "organizations" ORDER BY "created_at"`,
    )) as { id: string; slug: string }[];
    const taken = new Set(rows.map((r) => r.slug));
    for (const row of rows) {
      if (SLUG_PATTERN.test(row.slug)) continue;
      const base =
        row.slug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 36)
          .replace(/-+$/, '')
          .padEnd(3, '0') || 'school';
      let slug = base;
      for (let n = 2; taken.has(slug) || !SLUG_PATTERN.test(slug); n++) {
        slug = `${base}-${n}`;
      }
      taken.add(slug);
      await queryRunner.query(
        `UPDATE "organizations" SET "slug" = $2 WHERE "id" = $1`,
        [row.id, slug],
      );
      await queryRunner.query(
        `INSERT INTO "organization_slug_history" ("org_id", "slug", "expires_at")
         VALUES ($1, $2, now() + interval '12 months')`,
        [row.id, row.slug],
      );
    }
  }
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Frozen copy of `DEFAULT_PLANS` at the time of this migration. */
const FREE = ['sis', 'attendance', 'notices', 'results'];
const BASIC = [...FREE, 'fees', 'report_cards', 'portal', 'sms'];
const STANDARD = [
  ...BASIC,
  'hr',
  'timetable',
  'lms',
  'library',
  'custom_roles',
  'custom_domain',
];
const PREMIUM = [
  ...STANDARD,
  'transport',
  'hostel',
  'inventory',
  'multi_branch',
  'analytics',
  'api',
  'ai',
];
const PLANS = [
  {
    code: 'free',
    name: 'Free',
    pricePerStudent: 0,
    minFee: 0,
    modules: FREE,
    limits: { students: 100, storageMb: 500, users: null, admins: 1 },
    sortOrder: 1,
  },
  {
    code: 'basic',
    name: 'Basic',
    pricePerStudent: 1500,
    minFee: 100000,
    modules: BASIC,
    limits: { students: null, storageMb: 5120, users: null, admins: 3 },
    sortOrder: 2,
  },
  {
    code: 'standard',
    name: 'Standard',
    pricePerStudent: 2500,
    minFee: 200000,
    modules: STANDARD,
    limits: { students: null, storageMb: 20480, users: null, admins: null },
    sortOrder: 3,
  },
  {
    code: 'premium',
    name: 'Premium',
    pricePerStudent: 4000,
    minFee: 500000,
    modules: PREMIUM,
    limits: { students: null, storageMb: 102400, users: null, admins: null },
    sortOrder: 4,
  },
];
