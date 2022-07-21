# Twilio boaty

The following app / code is deployed as a twillio beta service (serverless).
This can the be used as an SMS service via devices such as the Garmin InReach. (Currently only via the Garmin InReach)...

## Commands

### Basic

#### hello

```
Hello, there!
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
1/1 METEO-FRANCE 1658203200 > 1658289600: Moderate thunderstorm warning.
```

You can also request long alerts (including full descriptions) using `openweather alerts long`

```
1/1 METEO-FRANCE 1658203200 > 1658289600: Moderate thunderstorm warning. Although rather usual in this region, locally or potentially dangerous phenomena are expected. (such as local winds, summer thunderstorms, rising streams or high waves)
```

## Development

The main entry point is `index.js` which imitates the behaviour of twilio with a primary function that is called, and a fallback on failure.

Thus the main application is in `src/welcome.js` with a simple fallback handler of `src/fallback.js`.

Mocking exists by default, you can find mock data in the `./mock` directory.
In order to get coordinates, an `inreachlink.com` http call is made.
Some commands then also make use of other services, such as openweathermap.org.

The InReach link `inreachlink.com/3JXBF7Z` already has mock data added for it.
So use this for testing pourposes.

### CLI

All commands can be run locally via the CLI.

Examples:

```sh
node index.js hello
node index.js openweather alerts inreachlink.com/3JXBF7Z
node index.js openweather sun inreachlink.com/3JXBF7Z
```

etc...

## Deployment

This app is currently deployed to twilio by @addshore.

In order to deploy, simply copy the `fallback.js` and `welcome.js` file contents to their respective locations in the twilio UI.

Hit `Save` and then hit `Deploy all`.

You also need the `OPENWEATHERMAP_KEY` variable defined.