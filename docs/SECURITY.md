# Musah Mobiles Website Security Boundary

## Current prototype

This folder is a browser-only prototype. Data and the owner password are stored in browser storage, so it must not be treated as production security. Anyone with access to the device, browser developer tools, or the project files may be able to inspect or modify local data.

Do not use this version to protect real financial records, customer data, IMEI numbers, or payment credentials.

## Required production design

1. Move authentication to a backend API.
2. Store only a slow password hash, never the plain password.
3. Use secure, HttpOnly, SameSite session cookies or short-lived access tokens.
4. Require server-side authorization for every owner route and mutation.
5. Require the current password again before changing the password.
6. Add rate limiting, failed-login lockout, and suspicious-login logging.
7. Add owner recovery using a verified private email/phone or recovery codes.
8. Add optional two-factor authentication.
9. Store products, sales, expenses, customers, and audit records in a protected database.
10. Store product images in validated private file storage.
11. Use HTTPS, input validation, output encoding, CSRF protection where applicable, and secure security headers.
12. Keep immutable audit history for price, stock, password, and financial changes.
13. Back up the database automatically and test restoration.
14. Support logout from all devices and session expiration.

## Password change rule

A leaked password cannot be made safe by adding another browser-side form. The production password-change endpoint must verify the authenticated session and current password on the server, invalidate existing sessions after a successful change, and record the change in the audit log.
