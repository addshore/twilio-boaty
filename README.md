# Twilio boaty

The following app / code is deployed as a twillio beta service (serverless).
This can the be used as an SMS service via devices such as the Garmin InReach. (Currently only via the Garmin InReach)...

## Commands

### Basic

#### hello

```
Hello, there!
```

#### bye

```
Goodbye!
```

#### debug

Infomation that was extracted from the inreach URL.

```
Extracted URL: inreachlink.com/3JXBF7Z, lat: 48.351141, lon: -4.546773 from the inreach URL
```

### openweather

#### sun

Current and next day sun and moon infomation.

For moon phase 0.5 indicates a full moon.

```
Jul 19 (today): Sun: 06:36 -> 22:11, Moon (phase 0.71): 01:04 -> 13:34
Jul 20: Sun: 06:38 -> 22:10, Moon (phase 0.71): 01:21 -> 14:46
```

### alerts

WORK IN PROGRESS (needs fixes such as times / dates & multiple messages for longer alerts)

Responds with current weather alerts from open weather.

```
No weather alerts for your area
```

OR

```
0) METEO-FRANCE Moderate thunderstorm warning 1658203200/1658289600
```

## Development

The main entry point is `index.js` which imitates the behaviour of twilio with a primary function that is called, and a fallback on failure.

Thus the main application is in `src/welcome.js` with a simple fallback handler of `src/fallback.js`.

### CLI

All commands can be run locally via the CLI.

Some commands require coordinates, which will be retrieved from the Garmin InReach link.
You can use  inreachlink.com/3JXBF7Z which is a location in Brest, France for testing pourposes.

Examples:

```sh
node index.js test
node index.js bye
node index.js hello
node index.js openweather sun inreachlink.com/3JXBF7Z
```

etc...

### Secrets / Context

Currently openweathermap.org is the only service that requires akey.

You can create an account at https://openweathermap.org/appid

The key will be consumed from the `OPENWEATHERMAP_KEY` context variable.

This MUST be set in a `context-private.json` file.
You can use the `context-example.json` file as an example...

## Deployment

This app is currently deployed to twilio by @addshore.

In order to deploy, simply copy the `fallback.js` and `welcome.js` file contents to their respective locations in the twilio UI.

Hit `Save` and then hit `Deploy all`.