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

#### wind

Wind forcase for current location

```
DATE:WIND(GUST),DIR(DEG) m/s
Jul 21 12:09: 4.63 N(20)
Jul 21 13:00: 4.15(4.72) NW(334)
Jul 21 14:00: 4.92(5.36) N(341)
Jul 21 15:00: 5.76(6.1) N(348)
...
```

Defaults to 6 hours of forcast.

You can specify a number of entries to return to increase this, such as `openweather wind 24`

Once hourly forcasts have run out, daily forcasts will be used.

#### sun

Sun and moon infomation (rise, set and moon phase)

For moon phase 0.5 indicates a full moon.

```
DATE,SUN,MOON(PHASE)
Jul 21:06:39>22:09,01:38>15:58(0.78)
Jul 22:06:40>22:08,01:57>17:08(0.81)
Jul 23:06:41>22:07,02:18>18:16(0.84)
```

You can request more days (up to 10) by adding a number to the command, such as `openweather sun 8`

### alerts

Responds with current weather alerts from open weather.

```
No weather alerts for your area
```

OR

```
METEO-FRANCE Jul 19 06:00 > Jul 20 06:00 Moderate thunderstorm warning.
```

You can also request long alerts (including full descriptions) using `openweather alerts long`

```
METEO-FRANCE Jul 19 06:00 > Jul 20 06:00 Moderate thunderstorm warning. Although rather usual in this region, locally or potentially dangerous phenomena are expected. (such as local winds, summer thunderstorms, rising streams or high waves)
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