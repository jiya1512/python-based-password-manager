# Security Notes

## Implemented

- Argon2id password hashing via `argon2-cffi`.
- Scrypt key derivation using a per-account random 16-byte salt.
- AES-256-GCM authenticated encryption with a fresh 12-byte nonce per encrypted entry.
- Additional authenticated data binds ciphertext to the KeyNest format version, user ID, and entry ID.
- Random UUID entry identifiers, parameterized SQLite queries, per-user authorization checks, CSRF header validation, and security response headers.
- HTTP-only, SameSite=Lax session cookie; Secure cookie can be enabled with `COOKIE_SECURE=1` behind HTTPS.
- Remember-login is an authenticated server-side session that lasts up to 14 days when explicitly selected.

## Limitations

- This is not zero-knowledge: the server receives the master password during authentication and stores the derived encryption key in server-side session storage while logged in. The server can decrypt credentials during an authenticated session.
- A compromised host, application process, session directory, or browser can expose credentials.
- No MFA, email verification, password reset, account recovery, formal rate limiting, audit, or independent penetration test is included.
- The SQLite database and server-side session directory contain sensitive data and must be private, backed up securely, and excluded from source control.
- The Flask development server is for local testing only. Production needs HTTPS, a production WSGI server, persistent storage, monitoring, and a reviewed deployment configuration.
- Do not commit `.env`, the `instance/` directory, database backups, session files, or real credentials.

Use dummy credentials while learning. This project is not a replacement for an independently audited password manager.
