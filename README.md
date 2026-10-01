# EventLink Backend

Standalone Node.js API for EventLink, built with Express, TypeScript, MongoDB, and Stellar SDK.

## Requirements

- Node.js 22 or newer
- npm
- MongoDB is optional for local development; the server uses an in-memory store when `MONGODB_URI` is unset or unavailable.

## Run locally

```sh
npm ci
cp .env.example .env
npm run dev
```

The API listens on `http://localhost:3001` by default. Set `FRONTEND_URL` to the deployed frontend origin so generated claim links return to the correct app.

## Production

Configure `NODE_ENV=production`, a random `JWT_SECRET` of at least 32 characters, `STRIPE_WEBHOOK_SECRET`, `FLUTTERWAVE_SECRET_HASH`, and any database, SMTP, and Stellar settings required by the deployment. Never commit `.env` or production secrets.

`npm run typecheck` checks the backend TypeScript source. The web frontend is maintained in [EVENT_LINK](https://github.com/orbit-flow-labs/EVENT_LINK); the Soroban contract is maintained in [EVENT_LINK_CONTRACT](https://github.com/orbit-flow-labs/EVENT_LINK_CONTRACT).