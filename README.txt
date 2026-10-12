Raja Luck Online Starter (Demo-only)
====================================

This is a starter Node.js app with:
- Server-side registration and login
- Password hashes (bcrypt)
- Session-based admin login
- Wingo-style colour/number demo predictions
- Server-side fake-point balance and game history
- Admin overview, user list, and demo-point reset
- No deposits, withdrawals, cash value, or real-money betting

Requirements:
- Node.js 18+ recommended
- npm

Run locally:
1. Extract this ZIP.
2. Open a terminal in the project folder.
3. Install packages: npm install
4. Set required environment variables.

Linux/macOS:
  export ADMIN_USER=admin
  export ADMIN_PASSWORD='choose-a-long-unique-password'
  export SESSION_SECRET='use-a-long-random-secret-value'
  npm start

Windows PowerShell:
  $env:ADMIN_USER="admin"
  $env:ADMIN_PASSWORD="choose-a-long-unique-password"
  $env:SESSION_SECRET="use-a-long-random-secret-value"
  npm start

5. Open http://localhost:3000

Important:
- Do not use the example admin username/password with a public deployment.
- Use HTTPS, a production session store, backups, rate limiting, CSRF protection, input validation, security monitoring, and a managed database before public production.
- The included JSON file is for a small prototype, not multi-instance hosting.
- This is not a real-money gambling platform. Do not collect deposits or enable cash withdrawals.
- Before public operation, get qualified legal advice about applicable laws, licensing and payment-provider terms.
