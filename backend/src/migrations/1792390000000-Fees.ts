import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M6, fees (backend plan 10):
 *
 * - Setup: `fee_heads`, `fee_structures` with `fee_structure_items`,
 *   `discount_types`, `student_discounts`, `late_fine_rules`.
 * - Billing: `invoices` and `invoice_lines` (money in `bigint` minor
 *   units), `billing_runs`.
 * - Collection: `payments`, `payment_allocations`, `receipts`,
 *   `payment_reversals`, and `adjustments` (refunds, waivers, corrections).
 * - Ledger: `expense_categories`, `expenses`, `ledger_entries`.
 * - RLS and app-role grants on every new table; the new permission keys
 *   on system roles (frozen copy).
 *
 * `down` drops the tables with their data.
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

const NEW_ORG_TABLES = [
  'adjustments',
  'billing_runs',
  'discount_types',
  'expense_categories',
  'expenses',
  'fee_heads',
  'fee_structure_items',
  'fee_structures',
  'invoice_lines',
  'invoices',
  'late_fine_rules',
  'ledger_entries',
  'payment_allocations',
  'payment_reversals',
  'payments',
  'receipts',
  'student_discounts',
];

const FEES_ALL = [
  'fees:read',
  'fees:setup',
  'fees:bill',
  'fees:collect',
  'fees:cancel_receipt',
  'fees:adjust',
  'fees:approve_waiver',
  'expenses:manage',
  'ledger:read',
];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: FEES_ALL,
  accountant: FEES_ALL,
  principal: ['fees:read', 'ledger:read'],
  class_teacher: ['fees:read'],
  receptionist: ['fees:read', 'fees:collect'],
  committee_member: ['fees:read', 'ledger:read'],
};

const CREATE_TABLES = [
  `CREATE TABLE "fee_heads" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "name_bn" character varying(80), "frequency" character varying(16) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5e15b796cf6b423c4f411109a44" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_c520bf28ddd673ba1b0d5e1f96" ON "fee_heads"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_fee_heads_org_name" ON "fee_heads"  ("org_id", "name") `,
  `CREATE TABLE "late_fine_rules" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "fee_head_id" uuid, "kind" character varying(16) NOT NULL, "amount" bigint NOT NULL, "grace_days" integer, "max_amount" bigint, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_46fa9b2fc4da11116570b7d450d" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_ef2872802c9e95b794d16f7d1d" ON "late_fine_rules"  ("org_id") `,
  `CREATE TABLE "invoices" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying(40) NOT NULL, "kind" character varying(16) NOT NULL, "student_id" uuid NOT NULL, "enrollment_id" uuid NOT NULL, "period" character varying(7) NOT NULL, "issue_date" date NOT NULL, "due_date" date NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'open', "total" bigint NOT NULL DEFAULT '0', "discount_total" bigint NOT NULL DEFAULT '0', "fine_total" bigint NOT NULL DEFAULT '0', "net_total" bigint NOT NULL DEFAULT '0', "adjusted_total" bigint NOT NULL DEFAULT '0', "allocated_total" bigint NOT NULL DEFAULT '0', "refunded_total" bigint NOT NULL DEFAULT '0', "bank_reference" character varying(24) NOT NULL, "note" text, "reminders_sent" integer NOT NULL DEFAULT '0', "created_by" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by" uuid, "cancel_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_824ca52f970e3ca5c8475ccee5" ON "invoices"  ("org_id") `,
  `CREATE INDEX "idx_invoices_open_due" ON "invoices"  ("org_id", "status", "due_date") `,
  `CREATE INDEX "idx_invoices_student" ON "invoices"  ("org_id", "student_id", "due_date") `,
  `CREATE UNIQUE INDEX "uq_invoices_generated_period" ON "invoices"  ("org_id", "enrollment_id", "period") WHERE "kind" = 'generated' AND "status" <> 'cancelled'`,
  `CREATE UNIQUE INDEX "uq_invoices_org_bank_reference" ON "invoices"  ("org_id", "bank_reference") `,
  `CREATE UNIQUE INDEX "uq_invoices_org_number" ON "invoices"  ("org_id", "number") `,
  `CREATE TABLE "invoice_lines" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "student_id" uuid NOT NULL, "kind" character varying(8) NOT NULL, "fee_head_id" uuid, "late_fine_rule_id" uuid, "period" character varying(7) NOT NULL, "description" character varying(200) NOT NULL, "amount" bigint NOT NULL DEFAULT '0', "discount" bigint NOT NULL DEFAULT '0', "discounts" jsonb NOT NULL DEFAULT '[]', "net" bigint NOT NULL DEFAULT '0', "adjusted" bigint NOT NULL DEFAULT '0', "allocated" bigint NOT NULL DEFAULT '0', "refunded" bigint NOT NULL DEFAULT '0', "cancelled" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3d18eb48142b916f581f0c21a65" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_932e69dc3ad16214fb873fdfd3" ON "invoice_lines"  ("org_id") `,
  `CREATE INDEX "idx_invoice_lines_invoice" ON "invoice_lines"  ("org_id", "invoice_id") `,
  `CREATE UNIQUE INDEX "uq_invoice_lines_fine" ON "invoice_lines"  ("org_id", "invoice_id", "late_fine_rule_id") WHERE "kind" = 'fine'`,
  `CREATE UNIQUE INDEX "uq_invoice_lines_fee" ON "invoice_lines"  ("org_id", "student_id", "fee_head_id", "period") WHERE "kind" = 'fee' AND "cancelled" = false`,
  `CREATE TABLE "adjustments" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(16) NOT NULL, "invoice_line_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "amount" bigint NOT NULL, "paid_from" character varying(8), "reason" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "requested_by" uuid, "decided_by" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "decision_note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9236bf670736e5ad5df36dd1eb4" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_d4c1cd196b9d248d235e317ed6" ON "adjustments"  ("org_id") `,
  `CREATE INDEX "idx_adjustments_status" ON "adjustments"  ("org_id", "status") `,
  `CREATE TABLE "billing_runs" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "period" character varying(7) NOT NULL, "automatic" boolean NOT NULL DEFAULT false, "class_ids" uuid array NOT NULL DEFAULT '{}', "invoices_created" integer NOT NULL DEFAULT '0', "lines_created" integer NOT NULL DEFAULT '0', "started_by" uuid, "finished_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6cbc5e20856bf81be0e61423167" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_25c012ec0e75c8b0a341bc90ea" ON "billing_runs"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_billing_runs_auto" ON "billing_runs"  ("org_id", "period") WHERE "automatic"`,
  `CREATE TABLE "discount_types" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "code" character varying(24) NOT NULL DEFAULT 'custom', "kind" character varying(16) NOT NULL, "value" bigint NOT NULL, "applies_to_head_ids" uuid array NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8680bade668df47e67dcdfc93b" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_2ae97fd9cf26cc9693e7c1eee0" ON "discount_types"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_discount_types_org_name" ON "discount_types"  ("org_id", "name") `,
  `CREATE TABLE "student_discounts" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "discount_type_id" uuid NOT NULL, "value_override" bigint, "from_period" character varying(7) NOT NULL, "to_period" character varying(7), "status" character varying(16) NOT NULL DEFAULT 'pending', "reason" text, "requested_by" uuid, "decided_by" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "decision_note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d9791052660736e702c448d15cc" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_e92ad9b5ce05b9a050d9b97df6" ON "student_discounts"  ("org_id") `,
  `CREATE INDEX "idx_student_discounts_student" ON "student_discounts"  ("org_id", "student_id", "status") `,
  `CREATE TABLE "fee_structures" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "academic_year_id" uuid NOT NULL, "class_id" uuid NOT NULL, "subject_group_id" uuid, "shift_id" uuid, "effective_from" date NOT NULL, "effective_to" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d634078deb9cf5ceb5788ad9b53" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_6ed822250fadfa21f54b764e00" ON "fee_structures"  ("org_id") `,
  `CREATE INDEX "idx_fee_structures_class" ON "fee_structures"  ("org_id", "academic_year_id", "class_id") `,
  `CREATE TABLE "fee_structure_items" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fee_structure_id" uuid NOT NULL, "fee_head_id" uuid NOT NULL, "amount" bigint NOT NULL, "due_day" integer, "months" integer array, CONSTRAINT "PK_dfb11c01a68b4d7169b26ed7e69" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_9b047fba74db3839abe4996182" ON "fee_structure_items"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_fee_structure_items" ON "fee_structure_items"  ("org_id", "fee_structure_id", "fee_head_id") `,
  `CREATE TABLE "expense_categories" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0ef31e189d9523461215b62775" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_0e320bace1e8992ff3573e4533" ON "expense_categories"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_expense_categories_org_name" ON "expense_categories"  ("org_id", "name") `,
  `CREATE TABLE "expenses" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "voucher_no" character varying(40) NOT NULL, "category_id" uuid NOT NULL, "amount" bigint NOT NULL, "paid_from" character varying(8) NOT NULL, "date" date NOT NULL, "note" text, "attachment_file_ids" uuid array NOT NULL DEFAULT '{}', "created_by" uuid, "voided_at" TIMESTAMP WITH TIME ZONE, "voided_by" uuid, "void_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_c3280549a9c5a42c2979d6bc93" ON "expenses"  ("org_id") `,
  `CREATE INDEX "idx_expenses_date" ON "expenses"  ("org_id", "date") `,
  `CREATE UNIQUE INDEX "uq_expenses_org_voucher" ON "expenses"  ("org_id", "voucher_no") `,
  `CREATE TABLE "ledger_entries" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "direction" character varying(8) NOT NULL, "account" character varying(8) NOT NULL, "amount" bigint NOT NULL, "source_type" character varying(24) NOT NULL, "source_id" uuid NOT NULL, "description" character varying(200) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_669874d4c60e42ca3899ee25c1" ON "ledger_entries"  ("org_id") `,
  `CREATE INDEX "idx_ledger_entries_account_date" ON "ledger_entries"  ("org_id", "account", "date") `,
  `CREATE TABLE "payments" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid, "payer_guardian_id" uuid, "channel" character varying(16) NOT NULL, "amount" bigint NOT NULL, "reference" character varying(80), "received_by" uuid, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL, "received_on" date NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'completed', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_dc24a985c9c67d76554830da74" ON "payments"  ("org_id") `,
  `CREATE INDEX "idx_payments_received" ON "payments"  ("org_id", "received_at") `,
  `CREATE TABLE "payment_allocations" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid NOT NULL, "invoice_line_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "amount" bigint NOT NULL, "reversed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a5c6ff22065ac772620c85f4efb" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_df31650455035a1394bc2289b8" ON "payment_allocations"  ("org_id") `,
  `CREATE INDEX "idx_payment_allocations_line" ON "payment_allocations"  ("org_id", "invoice_line_id") `,
  `CREATE INDEX "idx_payment_allocations_payment" ON "payment_allocations"  ("org_id", "payment_id") `,
  `CREATE TABLE "receipts" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying(40) NOT NULL, "payment_id" uuid NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, "issued_by" uuid, "status" character varying(16) NOT NULL DEFAULT 'valid', "cancel_reason" text, "cancelled_by" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5e8182d7c29e023da6e1ff33bfe" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_4f4abddda400150ca6f6d7fc3e" ON "receipts"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_receipts_payment" ON "receipts"  ("org_id", "payment_id") `,
  `CREATE UNIQUE INDEX "uq_receipts_org_number" ON "receipts"  ("org_id", "number") `,
  `CREATE TABLE "payment_reversals" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid NOT NULL, "receipt_id" uuid NOT NULL, "amount" bigint NOT NULL, "reason" text NOT NULL, "reversed_by" uuid, "reversed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_86787175c5da0282f62fbdf2d9c" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_25e70629222130e118e748c918" ON "payment_reversals"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_payment_reversals_payment" ON "payment_reversals"  ("org_id", "payment_id") `,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "fee_heads" ADD CONSTRAINT "FK_c520bf28ddd673ba1b0d5e1f967" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "late_fine_rules" ADD CONSTRAINT "FK_ef2872802c9e95b794d16f7d1d3" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "late_fine_rules" ADD CONSTRAINT "FK_041840b4fb4663a08111faac610" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "invoices" ADD CONSTRAINT "FK_824ca52f970e3ca5c8475ccee59" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "invoices" ADD CONSTRAINT "FK_0a19069218ffe36a4e4b41c4870" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "invoices" ADD CONSTRAINT "FK_2413e6ce6a8b64c541c4f629925" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_932e69dc3ad16214fb873fdfd3a" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_2da95dc86a54a00ff20ce46d0fe" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_fdb8b6f3a2caf60527d58d5e14b" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_9d6d5430d6fb99f71d5d3207307" FOREIGN KEY ("late_fine_rule_id") REFERENCES "late_fine_rules"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "adjustments" ADD CONSTRAINT "FK_d4c1cd196b9d248d235e317ed67" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "adjustments" ADD CONSTRAINT "FK_7cdcb1dd7090bf537311cf2231f" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "billing_runs" ADD CONSTRAINT "FK_25c012ec0e75c8b0a341bc90ea0" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "discount_types" ADD CONSTRAINT "FK_2ae97fd9cf26cc9693e7c1eee0d" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_e92ad9b5ce05b9a050d9b97df66" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_55cb3baeb2f1cfea0bacc7cb4f1" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_9c43fab0e729ed6e7c05aa96e86" FOREIGN KEY ("discount_type_id") REFERENCES "discount_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_6ed822250fadfa21f54b764e002" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_4649c7e79b41c39871d78afe0e4" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_e8d5f252faed8dfe19f49bbd780" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_6b48dc94cb62cd5f39b6293a50e" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_7dc148bb0065b7f669386cef470" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structure_items" ADD CONSTRAINT "FK_9b047fba74db3839abe4996182d" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structure_items" ADD CONSTRAINT "FK_879c2b9bf781665dd59915dd413" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "fee_structure_items" ADD CONSTRAINT "FK_d8376de7ab8834b56129864b745" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "expense_categories" ADD CONSTRAINT "FK_0e320bace1e8992ff3573e45337" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "expenses" ADD CONSTRAINT "FK_c3280549a9c5a42c2979d6bc934" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "expenses" ADD CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_669874d4c60e42ca3899ee25c16" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "payments" ADD CONSTRAINT "FK_dc24a985c9c67d76554830da744" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "payments" ADD CONSTRAINT "FK_9fd5d6ef620b0140a67ff2d95c4" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "payments" ADD CONSTRAINT "FK_a52eeb9242b154f8859e832a043" FOREIGN KEY ("payer_guardian_id") REFERENCES "guardians"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_df31650455035a1394bc2289b89" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_4348f49c6822420b9503ba880b8" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_5a357d2b5bf058cc15a6b017557" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_72095d7b95a6168756ea7d4fbc5" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "receipts" ADD CONSTRAINT "FK_4f4abddda400150ca6f6d7fc3ed" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "receipts" ADD CONSTRAINT "FK_d2cfb7a62d629121d47a89ab989" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "payment_reversals" ADD CONSTRAINT "FK_25e70629222130e118e748c9188" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "payment_reversals" ADD CONSTRAINT "FK_4ab2d1428f67d8c0f43dddfa658" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

const DROP = [
  `ALTER TABLE "payment_reversals" DROP CONSTRAINT "FK_4ab2d1428f67d8c0f43dddfa658"`,
  `ALTER TABLE "payment_reversals" DROP CONSTRAINT "FK_25e70629222130e118e748c9188"`,
  `ALTER TABLE "receipts" DROP CONSTRAINT "FK_d2cfb7a62d629121d47a89ab989"`,
  `ALTER TABLE "receipts" DROP CONSTRAINT "FK_4f4abddda400150ca6f6d7fc3ed"`,
  `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_72095d7b95a6168756ea7d4fbc5"`,
  `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_5a357d2b5bf058cc15a6b017557"`,
  `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_4348f49c6822420b9503ba880b8"`,
  `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_df31650455035a1394bc2289b89"`,
  `ALTER TABLE "payments" DROP CONSTRAINT "FK_a52eeb9242b154f8859e832a043"`,
  `ALTER TABLE "payments" DROP CONSTRAINT "FK_9fd5d6ef620b0140a67ff2d95c4"`,
  `ALTER TABLE "payments" DROP CONSTRAINT "FK_dc24a985c9c67d76554830da744"`,
  `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_669874d4c60e42ca3899ee25c16"`,
  `ALTER TABLE "expenses" DROP CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c"`,
  `ALTER TABLE "expenses" DROP CONSTRAINT "FK_c3280549a9c5a42c2979d6bc934"`,
  `ALTER TABLE "expense_categories" DROP CONSTRAINT "FK_0e320bace1e8992ff3573e45337"`,
  `ALTER TABLE "fee_structure_items" DROP CONSTRAINT "FK_d8376de7ab8834b56129864b745"`,
  `ALTER TABLE "fee_structure_items" DROP CONSTRAINT "FK_879c2b9bf781665dd59915dd413"`,
  `ALTER TABLE "fee_structure_items" DROP CONSTRAINT "FK_9b047fba74db3839abe4996182d"`,
  `ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_7dc148bb0065b7f669386cef470"`,
  `ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_6b48dc94cb62cd5f39b6293a50e"`,
  `ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_e8d5f252faed8dfe19f49bbd780"`,
  `ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_4649c7e79b41c39871d78afe0e4"`,
  `ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_6ed822250fadfa21f54b764e002"`,
  `ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_9c43fab0e729ed6e7c05aa96e86"`,
  `ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_55cb3baeb2f1cfea0bacc7cb4f1"`,
  `ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_e92ad9b5ce05b9a050d9b97df66"`,
  `ALTER TABLE "discount_types" DROP CONSTRAINT "FK_2ae97fd9cf26cc9693e7c1eee0d"`,
  `ALTER TABLE "billing_runs" DROP CONSTRAINT "FK_25c012ec0e75c8b0a341bc90ea0"`,
  `ALTER TABLE "adjustments" DROP CONSTRAINT "FK_7cdcb1dd7090bf537311cf2231f"`,
  `ALTER TABLE "adjustments" DROP CONSTRAINT "FK_d4c1cd196b9d248d235e317ed67"`,
  `ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_9d6d5430d6fb99f71d5d3207307"`,
  `ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_fdb8b6f3a2caf60527d58d5e14b"`,
  `ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_2da95dc86a54a00ff20ce46d0fe"`,
  `ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_932e69dc3ad16214fb873fdfd3a"`,
  `ALTER TABLE "invoices" DROP CONSTRAINT "FK_2413e6ce6a8b64c541c4f629925"`,
  `ALTER TABLE "invoices" DROP CONSTRAINT "FK_0a19069218ffe36a4e4b41c4870"`,
  `ALTER TABLE "invoices" DROP CONSTRAINT "FK_824ca52f970e3ca5c8475ccee59"`,
  `ALTER TABLE "late_fine_rules" DROP CONSTRAINT "FK_041840b4fb4663a08111faac610"`,
  `ALTER TABLE "late_fine_rules" DROP CONSTRAINT "FK_ef2872802c9e95b794d16f7d1d3"`,
  `ALTER TABLE "fee_heads" DROP CONSTRAINT "FK_c520bf28ddd673ba1b0d5e1f967"`,
  `DROP INDEX "public"."uq_payment_reversals_payment"`,
  `DROP INDEX "public"."IDX_25e70629222130e118e748c918"`,
  `DROP TABLE "payment_reversals"`,
  `DROP INDEX "public"."uq_receipts_org_number"`,
  `DROP INDEX "public"."uq_receipts_payment"`,
  `DROP INDEX "public"."IDX_4f4abddda400150ca6f6d7fc3e"`,
  `DROP TABLE "receipts"`,
  `DROP INDEX "public"."idx_payment_allocations_payment"`,
  `DROP INDEX "public"."idx_payment_allocations_line"`,
  `DROP INDEX "public"."IDX_df31650455035a1394bc2289b8"`,
  `DROP TABLE "payment_allocations"`,
  `DROP INDEX "public"."idx_payments_received"`,
  `DROP INDEX "public"."IDX_dc24a985c9c67d76554830da74"`,
  `DROP TABLE "payments"`,
  `DROP INDEX "public"."idx_ledger_entries_account_date"`,
  `DROP INDEX "public"."IDX_669874d4c60e42ca3899ee25c1"`,
  `DROP TABLE "ledger_entries"`,
  `DROP INDEX "public"."uq_expenses_org_voucher"`,
  `DROP INDEX "public"."idx_expenses_date"`,
  `DROP INDEX "public"."IDX_c3280549a9c5a42c2979d6bc93"`,
  `DROP TABLE "expenses"`,
  `DROP INDEX "public"."uq_expense_categories_org_name"`,
  `DROP INDEX "public"."IDX_0e320bace1e8992ff3573e4533"`,
  `DROP TABLE "expense_categories"`,
  `DROP INDEX "public"."uq_fee_structure_items"`,
  `DROP INDEX "public"."IDX_9b047fba74db3839abe4996182"`,
  `DROP TABLE "fee_structure_items"`,
  `DROP INDEX "public"."idx_fee_structures_class"`,
  `DROP INDEX "public"."IDX_6ed822250fadfa21f54b764e00"`,
  `DROP TABLE "fee_structures"`,
  `DROP INDEX "public"."idx_student_discounts_student"`,
  `DROP INDEX "public"."IDX_e92ad9b5ce05b9a050d9b97df6"`,
  `DROP TABLE "student_discounts"`,
  `DROP INDEX "public"."uq_discount_types_org_name"`,
  `DROP INDEX "public"."IDX_2ae97fd9cf26cc9693e7c1eee0"`,
  `DROP TABLE "discount_types"`,
  `DROP INDEX "public"."uq_billing_runs_auto"`,
  `DROP INDEX "public"."IDX_25c012ec0e75c8b0a341bc90ea"`,
  `DROP TABLE "billing_runs"`,
  `DROP INDEX "public"."idx_adjustments_status"`,
  `DROP INDEX "public"."IDX_d4c1cd196b9d248d235e317ed6"`,
  `DROP TABLE "adjustments"`,
  `DROP INDEX "public"."uq_invoice_lines_fee"`,
  `DROP INDEX "public"."uq_invoice_lines_fine"`,
  `DROP INDEX "public"."idx_invoice_lines_invoice"`,
  `DROP INDEX "public"."IDX_932e69dc3ad16214fb873fdfd3"`,
  `DROP TABLE "invoice_lines"`,
  `DROP INDEX "public"."uq_invoices_org_number"`,
  `DROP INDEX "public"."uq_invoices_org_bank_reference"`,
  `DROP INDEX "public"."uq_invoices_generated_period"`,
  `DROP INDEX "public"."idx_invoices_student"`,
  `DROP INDEX "public"."idx_invoices_open_due"`,
  `DROP INDEX "public"."IDX_824ca52f970e3ca5c8475ccee5"`,
  `DROP TABLE "invoices"`,
  `DROP INDEX "public"."IDX_ef2872802c9e95b794d16f7d1d"`,
  `DROP TABLE "late_fine_rules"`,
  `DROP INDEX "public"."uq_fee_heads_org_name"`,
  `DROP INDEX "public"."IDX_c520bf28ddd673ba1b0d5e1f96"`,
  `DROP TABLE "fee_heads"`,
];

export class Fees1792390000000 implements MigrationInterface {
  name = 'Fees1792390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of CREATE_TABLES) await queryRunner.query(sql);
    for (const sql of FOREIGN_KEYS) await queryRunner.query(sql);

    const role = appRole();
    for (const table of NEW_ORG_TABLES) {
      const t = `public.${quoteIdent(table)}`;
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(
        `CREATE POLICY org_isolation ON ${t} USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
      );
      if (role) {
        await queryRunner.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO ${role}`,
        );
      }
    }
    if (!role) {
      console.warn('Fees: DB_APP_USERNAME is not set, skipping grants.');
    }
    for (const [name, keys] of Object.entries(ROLE_KEYS)) {
      await queryRunner.query(
        `UPDATE "roles"
         SET "permissions" = "permissions" || ARRAY(
               SELECT k FROM unnest($2::text[]) AS k
               WHERE NOT (k = ANY("permissions"))
             ),
             "updated_at" = now()
         WHERE "is_system" AND "name" = $1`,
        [name, keys],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = ARRAY(
         SELECT k FROM unnest("permissions") AS k WHERE NOT (k = ANY($1::text[]))
       )`,
      [FEES_ALL],
    );
    for (const sql of DROP) await queryRunner.query(sql);
  }
}
