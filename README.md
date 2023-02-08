# GuestHouse example application

This demo application uses the phone number as the primary identifying credentials for a user
profile.

It verifies phone numbers using [tru.ID SubscriberCheck API](https://developer.tru.id/docs/subscriber-check/integration), in order to authenticate a user.

It allows the user to authenticate using a magic link when:

- the user is on WiFi
- the user's mobile provider is not covered by tru.ID

Please check the companion [blog entry](#) for more information.

## Requirements

- [ngrok](https://ngrok.com/) (so you can receive SubscriberCheck callbacks on your machine)
- [tru.ID developer account](https://tru.id/signup)

## Running

1. `ngrok http 3000`
2. `npm install`
3. export the following environment variables (see [this file](./.example.env) for more info)

```sh
export TRU_DATA_RESIDENCY=<tru.ID account data residency>
export TRU_CLIENT_ID=<tru.ID project client id>
export TRU_CLIENT_SECRET=<tru.ID project client secret>
export APP_BASE_URL=<ngrok tunnel url>
```

4. `node ./src/index.js | npx pino-pretty --ignore reqId`
5. Visit `<ngrok tunnel url>/guest-house`

## Contributing

1. Raise an issue that explains the improvement/fix you want to make
2. Fork the project
3. Submit a PR

## License

[MIT](./LICENSE)
