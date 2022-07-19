# Twilio boaty

The following app / code is deployed as a twillio beta service (serverless).

The code requires 1 service registration and the provision of a `OPENWEATHERMAP_KEY` env var.

This MUST be set in a `context-private.json` file for some functionality to work.
You can use the `context-example.json` file as an example...

## Calling locally

```sh
node index.js test
node index.js bye
node index.js hello
node index.js openweather sun inreachlink.com/3JXBF7Z
```

etc...