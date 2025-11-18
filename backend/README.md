Music Platform Backend - API Documentation

This repository contains the backend for a music platform. I generated the following artifacts for you:

- `openapi.yaml` - OpenAPI 3.0 spec describing all endpoints and schemas.
- `postman_collection.json` - Postman v2.1 collection that you can import into Postman.
- `curl_examples.ps1` - PowerShell script with example requests using Invoke-RestMethod (Windows-friendly "curl").

Base URL

This OpenAPI assumes the server runs at:

  https://localhost:3000

If your app mounts routes at `/api`, prepend `/api` to endpoints.

Authentication

Most protected endpoints require a JWT in the Authorization header:

  Authorization: Bearer <token>

Tokens are returned by `/auth/signup/*` and `/auth/login`.

Quick examples (PowerShell)

Run `curl_examples.ps1` with PowerShell to execute the examples; edit `$baseUrl` and supply tokens as required.

Importing the Postman collection

1. Open Postman
2. File > Import > select `postman_collection.json`
3. Create an environment with variable `baseUrl` (e.g., https://localhost:3000) and `token` if needed.

OpenAPI

See `openapi.yaml` for a machine-readable description of all routes, parameters, request bodies and example schemas.

Notes and caveats

- OTP endpoints will return `dev_otp` in responses when SMTP is not configured and the environment variable `EXPOSE_DEV_OTP` is not set to `false`.
- File uploads use multer and store files in `uploads/` locally (`media` endpoints).
- Controllers consult database schema dynamically in places (e.g., `getArtistGigs`) — ensure your DB matches expected tables and column names.

If you want, I can also:
- Generate a full OpenAPI JSON and hook it to Swagger UI in the repo.
- Create automated tests that exercise each endpoint (supertest/Jest).
- Add runtime request validation middleware (AJV or express-openapi-validator) and wire it to the OpenAPI spec.

