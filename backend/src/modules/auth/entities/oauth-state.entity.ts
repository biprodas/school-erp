import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum OAuthIntent {
  SIGNIN = 'signin',
  SIGNUP = 'signup',
  LINK = 'link',
}

/**
 * One Google sign-in in flight (doc/domains-and-routing.md 5a): single use,
 * 10 minutes. Holds the PKCE verifier and nonce, where to return and for
 * which school; `user_id` binds a `link` to the signed-in account. Only the
 * state's hash is stored. Root connection only.
 */
@Entity('oauth_states', { schema: 'public' })
export class OAuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('uq_oauth_states_hash', { unique: true })
  @Column({ name: 'state_hash', type: 'varchar', length: 64 })
  stateHash: string;

  @Column({ name: 'code_verifier', type: 'varchar', length: 128 })
  codeVerifier: string;

  @Column({ type: 'varchar', length: 64 })
  nonce: string;

  /** Host to send the browser back to (validated at start). */
  @Column({ name: 'return_host', type: 'varchar', length: 255 })
  returnHost: string;

  /** School the return host belongs to; null for the platform hosts. */
  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  /** Same-host path to land on afterwards. */
  @Column({ type: 'varchar', length: 512, default: '/' })
  next: string;

  @Column({ type: 'varchar', length: 16 })
  intent: OAuthIntent;

  /** The signed-in account a `link` is for. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
