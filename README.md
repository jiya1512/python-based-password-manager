# KeyNest — Python Backend Password Vault

KeyNest is a learning project that combines a password-strength checker with an account-based password vault. The frontend is HTML/CSS/JavaScript; the backend is Python Flask with PostgreSQL.

## Features

- Sign up and sign in with a username and master password.
- Argon2id password hashing for login verification.
- Scrypt key derivation and AES-256-GCM authenticated encryption for each saved vault entry.
- Unique random salt per account and a fresh random nonce for each entry encryption.
- Website/app name, URL, username/email, password, notes, edit, delete, reveal, copy, search, and mark-used count.
- Frequently used entries and password strength checks.
- Optional “Remember this login” session for up to 14 days on a trusted device. Unchecked sessions are browser-session cookies.
- PostgreSQL database and server-side sessions.
- CSRF token checks for state-changing API requests and basic security headers.

## Run locally on Kali Linux

Python 3.10+ and a PostgreSQL database are required.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

Set `DATABASE_URL` to your PostgreSQL connection string, then start the app:

```bash
export DATABASE_URL='postgresql://user:password@localhost:5432/keynest'
python backend/app.py
```

Open `http://127.0.0.1:5000`.

The app creates its PostgreSQL tables on first run, along with a local development secret and server-side session files. The secret and session files are local runtime data and must not be committed.

## Deploying

GitHub Pages cannot run the Python backend. On Render, create a PostgreSQL database and a Python web service from this repository. Set the web service's `DATABASE_URL` to the database's internal connection string. Use `pip install -r backend/requirements.txt` as the build command and `gunicorn --chdir backend --bind 0.0.0.0:$PORT app:app` as the start command.

Set a strong random `SECRET_KEY` environment variable on the host. Generate one locally with:

```bash
python -c 'import secrets; print(secrets.token_hex(32))'
```

Do not commit that value. Also configure:

- `DATABASE_URL` to the PostgreSQL connection string supplied by Render.
- `SESSION_FILE_DIR` to a writable directory if you want to control where server-side sessions are stored. Sessions stored on an ephemeral filesystem are cleared when the service restarts, which signs users out but does not remove their vault data in PostgreSQL.
- `COOKIE_SECURE=1` when served over HTTPS.
- `PORT` if the host supplies a port environment variable.

Use the host's production WSGI command, for example `gunicorn --chdir backend app:app`. Do not expose Flask's development server to the public internet. Set up HTTPS, backups, monitoring, and host-level access controls before real use.

## Important security model

This backend hashes the master password with Argon2id and derives a vault encryption key with Scrypt. Vault fields are encrypted with AES-256-GCM before they are written to PostgreSQL. AAD binds each ciphertext to the account and entry identifier.

**This is not zero-knowledge encryption.** The Python process receives the master password at sign-in and keeps the derived vault key in its server-side session so it can decrypt entries for the UI. The server operator or a compromised server process could access decrypted credentials while the vault is in use. HTTPS is required for deployment. This is a learning project and has not undergone an independent security audit; do not use it for critical credentials.

There is no password reset flow. If the master password is lost, the encrypted entries cannot be decrypted. Back up the database securely and test restoration before relying on it.
