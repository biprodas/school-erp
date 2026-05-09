export enum UserStatus {
	PENDING = 'pending',       // registered, email not verified
	ACTIVE = 'active',         // verified, full access
	SUSPENDED = 'suspended',   // admin-suspended, can't login
	DEACTIVATED = 'deactivated', // self-deactivated
	BANNED = 'banned',         // permanent ban
}