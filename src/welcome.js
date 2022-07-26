const axios = require('axios');
const { floor } = require('lodash');

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.MessagingResponse();
  let messages = await exports.innerHandler(context, event.Body.toLowerCase())
  // Send multiple messages (if required)
  // https://www.twilio.com/docs/messaging/twiml?code-sample=code-send-two-messages&code-language=Node.js&code-sdk-version=3.x
  messages.forEach( msg => {
    twiml.message(msg)
  })
  return callback(null, twiml);
};

exports.innerHandler = async (context, messageIn) => {
  let textResponse = await exports.work(context, messageIn)

  // Send multiple messages (if required)
  let msgs = []
  stringToMessages(textResponse).forEach (msg => {
    msgs.push(msg)
  })
  return msgs
};

exports.work = async (context, messageIn) => {
  let lat = null
  let lon = null

  // Set debug, if requested by the message, and strip it from the message continuing
  const debug = messageIn.startsWith('debug')
  messageIn = messageIn.replace(/^debug ?/,'')
  if (debug) {
    console.log("Debug: " + JSON.stringify(messageIn))
  }

  // Get coordinates from a user passwed option
  const coordinateMatcher = messageIn.match(/(?:C|CO|CORD)(?: |,|:)? ?(-?\d+(?:\.\d+)?)(?: |,)?(-?\d+(?:\.\d+)?)/i)
  if(coordinateMatcher) {
    lat = coordinateMatcher[1]
    lon = coordinateMatcher[2]
    if (debug) {
      console.log("Debug: Coords from argument: " + lat + " " + lon)
    }
  }

  // Extract data from an inReach link if it exists and we don't have coordinates
  const hasInreachLink = messageIn.includes('inreachlink.com')
  var inreachData = false;
  if (lat == null && lon == null && hasInreachLink) {
    var inreachLink = inreachMatchLink(messageIn)
    inreachData = await inreachDataFromLink(inreachLink)
    if (inreachData) {
      lat = inreachData.lat;
      lon = inreachData.lon;
    }
    if (debug) {
      console.log("Debug: Coords from Garmin InReach link " + inreachLink)
      if( lat && lon ) {
        return 'Debug: Extracted URL: ' + inreachData.url + ', lat: ' + lat + ', lon: ' + lon + ' from the Garmin InReach URL'
      } else if ( hasInreachLink ) {
        return 'Debug: No data extracted from URL: ' + inreachLink
      } else {
        return 'Debug: No Garmin InReach link detected'
      }
    }
  }

  ////////////////////////////////////
  // Responses
  ////////////////////////////////////

  // Very basic hellow goodbye test commands
  if ( messageIn.startsWith('hello') ) {
    return 'Hello, there!'
  }

  // openweather
  if ( messageIn.startsWith('openweather') ) {

    // If we have no coordinates, tell the user to submit a location
    if ( !lat || !lon ) {
      return "openweather requested, but no location provided."
    }

    // All open weather commands currently make use of the one-call-api, so make that request!
    // https://openweathermap.org/api/one-call-api
    const weatherResponse = await axios
      .get("https://api.openweathermap.org/data/2.5/onecall", {
        params: {
          lat: lat,
          lon: lon,
          appid: context.OPENWEATHERMAP_KEY,
        }
      })
      .catch((error) => {
        // Be sure to handle any async errors, and return them in callback to end
        // Function execution if it makes sense for your application logic
        console.error(error);
      });
    if ( !weatherResponse || !weatherResponse.data ) {
      return"Error retrieving weather infomation from openweathermap.org"
    }

    // openweather alerts
    if ( messageIn.startsWith('openweather alerts') ) {
      if (!weatherResponse.data.alerts || weatherResponse.data.alerts.length == 0) {
        return'No weather alerts for your area'
      } else {
        let alertsMessage = ""
        let totalAlerts = weatherResponse.data.alerts.length
        for (let i = 0; i < totalAlerts; i++) {
          let alertData = weatherResponse.data.alerts[i]
          let tz = weatherResponse.data.timezone_offset
          let alertString = alertData.sender_name + " " + openweatherDateTime(tz, alertData.start) + " > " + openweatherDateTime(tz, alertData.end) + " " + alertData.event + "."
          if (messageIn.startsWith('openweather alerts long')) {
            alertString = alertString + " " + alertData.description
          }
          alertsMessage = alertsMessage + alertString + "\n"
        }
        return alertsMessage.trim()
      }
    }
    
    // openweather sun / moon
    if ( messageIn.startsWith('openweather sun') || messageIn.startsWith('openweather moon') ) {
      let entries = entriesForCommand(messageIn, 2, /openweather (sun|moon) (\d+)/, 2, 10)
      let tz = weatherResponse.data.timezone_offset
      let sunString = "DATE,SUN,MOON(PHASE)\n";
      for(let i = 0; i < entries; i++) {
        if( i >= 1 ) {
          sunString = sunString + "\n"
        }
        sunString = sunString + openweatherDate(tz, weatherResponse.data.daily[i].sunrise) + ":" +
        openweatherTime(tz, weatherResponse.data.daily[i].sunrise) + ">" + openweatherTime(tz, weatherResponse.data.daily[i].sunset) +
        "," + openweatherTime(tz, weatherResponse.data.daily[i].moonrise) + ">" + openweatherTime(tz, weatherResponse.data.daily[i].moonset) + "(" + weatherResponse.data.daily[i].moon_phase + ")"
      }
      return sunString
    }

    // openweather wind (IN metre/sec)
    if ( messageIn.startsWith('openweather wind') ) {
      // Collect user input
      // Default to hourly and then daily
      let useHourly = messageIn.match(/openweather wind .*?(hour|hourly)/);
      let useDaily = messageIn.match(/openweather wind .*?(day|daily)/);
      if (!useHourly && !useDaily) {
        useHourly = true
        useDaily = true
      }

      let forcastsToUse = openWeatherCollectForcasts(
        weatherResponse.data,
        useHourly,
        useDaily,
        // Limit of 100 entries is ~ 10 messages
        entriesForCommand(messageIn, 2, /openweather wind( [a-z]+)? (\d+)/, 6, 100)
      )

      // Build a response
      let header = "DATE\HOUR: WIND(GUST),DIR(DEG) m/s\n";
      let output = header;
      let lastDateOutput = "";
      forcastsToUse.forEach( forcast => {
        let date = openweatherDate(weatherResponse.data.timezone_offset, forcast.dt)
        let time = openweatherTime(weatherResponse.data.timezone_offset, forcast.dt)
        let speed = forcast.wind_speed
        let gust = forcast.wind_gust
        let degrees = forcast.wind_deg
        let direction = degreesToDirection(degrees)

        if(forcast.hourly){
          if(lastDateOutput != date) {
            output = output + date + "\n"
            lastDateOutput = date
          }
          output = output + time + ": "
        }
        if(forcast.daily) {
          output = output + date + ": "
        }

        output = output + speed
        if ( gust ) {
          output = output + "(" + gust + ")"
        }
        output = output + direction + "(" + degrees + ")\n"
      })

      return output.trim()
    }

    // openweather temp (IN kelvin...)
    if ( messageIn.startsWith('openweather temp') ) {
      // Collect user input
      // Default to hourly and then daily
      let useHourly = messageIn.match(/openweather temp .*?(hour|hourly)/);
      let useDaily = messageIn.match(/openweather temp .*?(day|daily)/);
      if (!useHourly && !useDaily) {
        useHourly = true
        useDaily = true
      }

      let forcastsToUse = openWeatherCollectForcasts(
        weatherResponse.data,
        useHourly,
        useDaily,
        // Limit of 100 entries is ~ 10 messages
        entriesForCommand(messageIn, 2, /openweather temp( [a-z]+)? (\d+)/, 6, 100)
      )

      // Build a response
      let header = "DATE\HOUR:TEMP feels FEELING in kelvin\n";
      let output = header;
      let lastDateOutput = "";
      forcastsToUse.forEach( forcast => {
        let date = openweatherDate(weatherResponse.data.timezone_offset, forcast.dt)
        let time = openweatherTime(weatherResponse.data.timezone_offset, forcast.dt)
        if(forcast.hourly){
          if(lastDateOutput != date) {
            output = output + date + "\n"
            lastDateOutput = date
          }
          output = output + time + ": " + forcast.temp + " feels " + forcast.feels_like + "\n"
        }
        if(forcast.daily) {
          output = output + date + " "+ forcast.temp.min +">" + forcast.temp.max + " "
          output = output + "morn:" + forcast.temp.morn + " day:" + forcast.temp.day + " eve:" + forcast.temp.eve + " night:" + forcast.temp.night + "\n"
        }
      })

      return output.trim()
    }
  }
  
  return 'Command not recognized, please use one of: hello, openweather alerts, openweather sun, openweather wind'
}

// START Garmin InReach functions
var inreachMatchLink = function ( text ) {
  return text.match(/(inreachlink.com[^ ]*)/)[1];
}
var inreachDataFromLink = async function ( link ) {
  let response = await axios
  .get("https://" + link)
  .catch((error) => {
    // Be sure to handle any async errors, and return them in callback to end
    // Function execution if it makes sense for your application logic
    console.error(error);
  });

  if ( !response || !response.data ) {
    return null
  }

  // Matching lines from some JS that is loaded on the page
  // The starts of lines are provided for convenience
  // User : {"Id":585830,"AssignedDeviceId":null,"Has ..........
  var extractedUser = JSON.parse(response.data.match(/User\s*:\s*({.*})/i)[1])
  // data: {"L":51.296935,"N":-2.140708,"A":89.77,"G":1.0000,
  var extractedData = JSON.parse(response.data.match(/data\s*:\s*({.*})/i)[1])
  return {
    url: link,
    inreachUid: extractedUser.Id,
    firstName: extractedUser.FirstName,
    lastName: extractedUser.LastName,
    date: extractedData.D, //2022-04-04T06:34:30Z
    lat: extractedData.L,
    lon: extractedData.N,
    altMeters: extractedData.A,
    speedKmphOne: extractedData.G,
    speedKmphTwo: extractedData.C,
    msg: extractedData.X,
  }
}
// END Garmin InReach functions

// START openweathermap functions
let openweatherTime = function( timezoneOffset, utcSeconds ) {
  let dateObject = new Date(0)
  dateObject.setUTCSeconds(utcSeconds + timezoneOffset)
  let timeOptions = {
    timeZone: "UTC",
    hour12: false,
    hour: '2-digit',
    minute:'2-digit'
  }
  return dateObject.toLocaleTimeString("en-US", timeOptions)
}

let openweatherDate = function( timezoneOffset, utcSeconds ) {
  let dateObject = new Date(0)
  dateObject.setUTCSeconds(utcSeconds + timezoneOffset)
  let dateOptions = {
    timeZone: "UTC",
    day: 'numeric',
    month: 'short'
  }
  return dateObject.toLocaleDateString("en-US", dateOptions)
}

let openweatherDateTime = function ( timezoneOffset, utcSeconds ) {
  return openweatherDate(timezoneOffset, utcSeconds) + " " + openweatherTime(timezoneOffset, utcSeconds)
}

let openWeatherCollectForcasts = function( weatherData, useHourly, useDaily, limit ) {
  // Collect forcases to use
  let forcasts = []
  weatherData.current.hourly = true
  forcasts.push(weatherData.current)
  let lastDtCollected = weatherData.current.dt
  if(useHourly){
    for(let i = 0; ( i <= limit && forcasts.length < limit && weatherData.hourly[i] ); i++ ) {
      if ( weatherData.hourly[i].dt < lastDtCollected ){
        continue;
      }
      weatherData.hourly[i].hourly = true
      forcasts.push(weatherData.hourly[i])
      lastDtCollected = weatherData.hourly[i].dt
    }
  }
  if(useDaily){
    for(let i = 0; ( i <= limit && forcasts.length < limit && weatherData.daily[i] ); i++ ) {
      if ( weatherData.daily[i].dt < lastDtCollected ){
        continue;
      }
      weatherData.daily[i].daily = true
      forcasts.push(weatherData.daily[i])
      lastDtCollected = weatherData.daily[i].dt
    }
  }
  return forcasts
}

// END openweathermap functions

// START general functions

/**
 * Splits a single big string which is easy for commands to return into messages appropriate for InReach
 * Commands can use \n to split messages in places that make sense
 * Otherwise they will be split just before the message boundry and paged
 * @param {string} text
 * @returns string[]
 */
let stringToMessages = function (text) {
  let msgs = []
  // 154 Number of characters that Garm InReach will actually send
  let charsPerSingleMessage = 154
  // 150 Allows adding "10/\n" to the statrt of messages to preserve order
  let charsPerPagedMessage = charsPerSingleMessage - 4

  // If its just gonna be 1 message, skip all of this logic
  if (text.length <= charsPerSingleMessage) {
    return [text]
  }

  while (text.length > charsPerPagedMessage) {
    let nextSection = text.slice(0,charsPerPagedMessage)
    // If we detected a new line, split it there (nicely)
    let lastNewLine = nextSection.match(/\n.*?$/);
    if (lastNewLine != null) {
      nextSection = text.slice(0,lastNewLine.index + 1)
    }
    // Record the message, and remove it form the text we are looking at
    msgs.push((msgs.length + 1) + "/\n" + nextSection.trim())
    text = text.slice(nextSection.length)
  }
  // If we have characters left over, put them in the last message
  if(text.length > 0) {
    msgs.push((msgs.length + 1) + "/\n" + text.trim())
  }

  return msgs
}

/**
 * Extract number of entries to return from a command
 * @param {string} message to match from
 * @param {int} matchGroup from the matcher to match
 * @param {RegExp} matcher that has group 1 matching the number of entries
 * @param {int} def the default entries to return
 * @param {int} max maximum number of entries to return
 * @returns int
 */
let entriesForCommand = function(message, matchGroup, matcher, def, max) {
  let entryMatcher = message.match(matcher);
  let entries = def
  if (entryMatcher != null) {
    entries = entryMatcher[matchGroup]
    if(entries > max) {
      // Don't allow more than the max number of entires
      entries = max
    }
  }
  return entries
}

let degreesToDirection = function (degrees) {
  let sections = 8
  let sectionDeg = 360 / sections
  let sliceRaw = ( degrees + ( sectionDeg / 2) ) / sectionDeg;
  let slice = floor(sliceRaw)

  switch (slice) {
    case 0:
    case 8:
      return "N"
    case 1:
      return "NE"
    case 2:
      return "E"
    case 3:
      return "SE"
    case 4:
      return "S"
    case 5:
      return "SW"
    case 6:
      return "W"
    case 7:
      return "NW"
    default:
      return "?s"
  }
}
// END general functions