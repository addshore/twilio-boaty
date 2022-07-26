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

openweather commands require location to be provided.
For the Garmin InReach this will be extracted from the provided URL if you enable location.

You can also provide coordinates manually that will overrride the Garmin InReach link to check other locations, or use other devices.

```
open weather <command> CORD: 48.35,-4.54
```

Aliases also exist for `CORD`. You can use `CO` or `C`.

#### wind

Wind forcast for current location

```
DATEHOUR: WIND(GUST),DIR(DEG) m/s
Jul 21
12:09: 4.63N(20)
13:00: 4.15(4.72)NW(334)
14:00: 4.92(5.36)N(341)
15:00: 5.76(6.1)N(348)
...
```

Defaults to looking at hourly and daily forcasts, returning 6 entries (6 hours).
You can specify a number of entries to return by adding a number to the end of the message, such as `openweather wind 24`
Once hourly forcasts have run out, daily forcasts will be used.
You can also select to only have hourly or daily infomation with `openweather wind day 5` or `openweather wind hour 12`

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

### Mocking calls

Some commands then also make use of other services, such as openweathermap.org, or Garmin InReach.

You can mock calls with some example data by passing `BOATY_MOCK=1` before your command.

You can find mock data in the `./mock` directory.

Coordniates can be provided as an argument to the command, or from a Garmin InReach link.

The InReach link `inreachlink.com/3JXBF7Z` already has mock data added for it.
So use this for testing.

### Using real calls

Currently the one service you would need to provide a key for is openweathermap.org

Right now it is not supported in the development version, but would be easily added.

See the top of `index.js` `const context = {}`

`context.OPENWEATHERMAP_KEY` must be set.

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