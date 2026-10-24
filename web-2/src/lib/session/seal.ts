import { hkdfSync } from "node:crypto"

import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose"

import type { Session } from "./types"

const keys = new Map<string, Uint8Array>()

/** 256-bit key for A256GCM, derived from `SESSION_SECRET` with HKDF. */
function keyFor(secret: string): Uint8Array {
  let key = keys.get(secret)
  if (!key) {
    key = new Uint8Array(
      hkdfSync("sha256", secret, "", "kampasy session cookie v1", 32)
    )
    keys.set(secret, key)
  }
  return key
}

/** Encrypts the session (JWE, `dir` + `A256GCM`), expiring with its refresh token. */
export function seal(session: Session, secret: string): Promise<string> {
  return new EncryptJWT(session as unknown as JWTPayload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(session.rtExp)
    .encrypt(keyFor(secret))
}

/**
 * The session in a sealed cookie value, or null when it is missing,
 * tampered with, sealed with another secret, expired or of an older shape.
 */
export async function unseal(
  token: string | null | undefined,
  secret: string
): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtDecrypt(token, keyFor(secret), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    })
    return isSession(payload) ? payload : null
  } catch {
    return null
  }
}

function isSession(payload: unknown): payload is Session {
  const p = payload as Partial<Session> | null
  return (
    !!p &&
    p.v === 1 &&
    (p.realm === "tenant" || p.realm === "platform") &&
    typeof p.at === "string" &&
    typeof p.rt === "string" &&
    typeof p.sid === "string" &&
    typeof p.atExp === "number" &&
    typeof p.rtExp === "number" &&
    typeof p.user?.id === "string"
  )
}
