import { MigrationInterface, QueryRunner } from 'typeorm';

const SAMPLE_TABLES = ['cats', 'tasks', 'products'];
const SAMPLE_PERMISSION_PATTERNS = ['cats:%', 'tasks:%', 'products:%'];
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

/**
 * Removes the cats/tasks/products sample modules: their tables, and their
 * permission keys from every stored role (the catalog no longer has them, so
 * a role still listing them couldn't be saved again).
 */
export class DropSampleModules1792311370259 implements MigrationInterface {
  name = 'DropSampleModules1792311370259';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles"
       SET "permissions" = ARRAY(
         SELECT p FROM unnest("permissions") AS p WHERE NOT (p LIKE ANY ($1::text[]))
       )
       WHERE EXISTS (
         SELECT 1 FROM unnest("permissions") AS p WHERE p LIKE ANY ($1::text[])
       )`,
      [SAMPLE_PERMISSION_PATTERNS],
    );
    for (const table of SAMPLE_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tasks_status_enum"`);
  }

  /**
   * Recreates the empty tables as InitialSchema did, with their RLS policy.
   * Removed permission keys are not restored.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_status_enum" AS ENUM('todo', 'in_progress', 'done')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "description" text, "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'todo', "due_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text NOT NULL, "price" numeric(10,2) NOT NULL, "stock" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cats" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "breed" character varying(120), "age" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_611e3c0a930b4ddc1541422864c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a7a4f687b74075698d59c172b" ON "tasks" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e709b3421913dcef3ab9b4794e" ON "products" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9173f117e5c501be386b9c4261" ON "cats" ("org_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_6a7a4f687b74075698d59c172b5" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_e709b3421913dcef3ab9b4794e2" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cats" ADD CONSTRAINT "FK_9173f117e5c501be386b9c4261c" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    for (const table of SAMPLE_TABLES) {
      await queryRunner.query(
        `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `CREATE POLICY org_isolation ON public."${table}" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
      );
    }
  }
}
