const axios = require('axios');
const { round, floor } = require('lodash');
const { ucs2 } = require('punycode');

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.MessagingResponse();
  let responses = await exports.work(context, event.Body.toLowerCase())
  // Send multiple messages (if required)
  // https://www.twilio.com/docs/messaging/twiml?code-sample=code-send-two-messages&code-language=Node.js&code-sdk-version=3.x
  responses.forEach( response => {
    twiml.message(response)
  })
  return callback(null, twiml);
};

exports.work = async (context, messageIn) => {
  let responses = []
  // Set debug, if requested by the message
  const debug = messageIn.startsWith('debug')
  messageIn = messageIn.replace(/^debug ?/,'')
  if (debug) {
    console.log("Debug: " + JSON.stringify(messageIn))
  }

  // Extract data from an inReach link if it exists...
  const hasInreachLink = messageIn.includes('inreachlink.com')
  var inreachData = false;
  if (hasInreachLink) {
    var inreachLink = inreachMatchLink(messageIn)
    inreachData = await inreachDataFromLink(inreachLink)
    if (debug) {
      console.log("Debug: " + inreachLink)
      console.log("Debug: " + JSON.stringify(inreachData))
    }
  }

  ////////////////////////////////////
  // Responses
  ////////////////////////////////////

  // Debugging a message, respond with the infomation extracted from the inReach link (or not)
  if ( debug ) {
    if( hasInreachLink && inreachData ) {
      responses.push('Debug: Extracted URL: ' + inreachData.url + ', lat: ' + inreachData.lat + ', lon: ' + inreachData.lon + ' from the inReach URL')
    } else if ( hasInreachLink ) {
      responses.push('Debug: No data extracted from URL: ' + inreachLink)
    } else {
      responses.push('Debug: No inreach link detected')
    }
  }

  // Very basic hellow goodbye test commands
  if ( messageIn.startsWith('hello') ) {
    responses.push('Hello, there!');
    return responses
  }

  // openweather
  if ( messageIn.startsWith('openweather') ) {
    // If we have no inreach link, tell the user to submit locations
    if ( !inreachData ) {
      responses.push("openweather requested, but no inreach link found. Please enable loction in your messages!")
      return responses
    }

    // All open weather commands currently make use of the one-call-api, so make that request!
    // https://openweathermap.org/api/one-call-api
    const weatherResponse = await axios
      .get("https://api.openweathermap.org/data/2.5/onecall", {
        params: {
          lat: inreachData.lat,
          lon: inreachData.lon,
          appid: context.OPENWEATHERMAP_KEY,
        }
      })
      .catch((error) => {
        // Be sure to handle any async errors, and return them in callback to end
        // Function execution if it makes sense for your application logic
        console.error(error);
      });
    if ( !weatherResponse || !weatherResponse.data ) {
      responses.push("Error retrieving weather infomation from openweathermap.org")
      return responses
    }

    // openweather alerts
    if ( messageIn.startsWith('openweather alerts') ) {
      if (!weatherResponse.data.alerts || weatherResponse.data.alerts.length == 0) {
        responses.push('No weather alerts for your area');
        return responses
      } else {
        let totalAlerts = weatherResponse.data.alerts.length
        for (let i = 0; i < totalAlerts; i++) {
          let alertData = weatherResponse.data.alerts[i]
          let tz = weatherResponse.data.timezone_offset
          let alertString = (i+1) + "/" + totalAlerts + " " + alertData.sender_name + " " + openweatherDateTime(tz, alertData.start) + " > " + openweatherDateTime(tz, alertData.end) + ": " + alertData.event + "."
          if (messageIn.startsWith('openweather alerts long')) {
            alertString = alertString + " " + alertData.description
          }
          responses.push(alertString)
        }
        return responses
      }
    }
    
    // openweather sun / moon
    if ( messageIn.startsWith('openweather sun') || messageIn.startsWith('openweather moon') ) {
      let entries = entriesForCommand(messageIn, 2, /openweather (sun|moon) (\d+)/, 2, 10)
      let tz = weatherResponse.data.timezone_offset
      let sunString = "";
      for(let i = 0; i < entries; i++) {
        if( i >= 1 ) {
          sunString = sunString + "\n"
        }
        sunString = sunString + (i+1) + ") " + openweatherDate(tz, weatherResponse.data.daily[i].sunrise) + " : " +
        "Sun: " + openweatherTime(tz, weatherResponse.data.daily[i].sunrise) + " > " + openweatherTime(tz, weatherResponse.data.daily[i].sunset) +
        ", Moon (phase " + weatherResponse.data.daily[i].moon_phase + "): " + openweatherTime(tz, weatherResponse.data.daily[i].moonrise) + " -> " + openweatherTime(tz, weatherResponse.data.daily[i].moonset)
      }
      responses.push(sunString)
      return responses
      }

    // openweather wind (IN metre/sec)
    if ( messageIn.startsWith('openweather wind') ) {
      let entries = entriesForCommand(messageIn, 1, /openweather wind (\d+)/, 6, 50)
      let openweatherForcastToWindString = function (timezone_offset, forcast) {
        let fString = openweatherDateTime(timezone_offset, forcast.dt) + ": " + forcast.wind_speed
        if ( forcast.wind_gust ) {
          fString = fString + "(" + forcast.wind_gust + ")"
        }
        fString = fString
        fString = fString + " " + degreesToDirection(forcast.wind_deg) + "(" + forcast.wind_deg + ")";
        return fString
      }
      let entriesDone = 1
      let lastDtReported = weatherResponse.data.current.dt
      let windString = "Wind in m/s\n" + openweatherForcastToWindString(weatherResponse.data.timezone_offset, weatherResponse.data.current)
      for(let i = 0; ( i <= entries && entriesDone <= entries && weatherResponse.data.hourly[i] ); i++ ) {
        if ( weatherResponse.data.hourly[i].dt < lastDtReported ){
          continue;
        }
        windString = windString + "\n" + openweatherForcastToWindString(weatherResponse.data.timezone_offset, weatherResponse.data.hourly[i]);
        lastDtReported = weatherResponse.data.hourly[i].dt
        entriesDone++
      }
      for(let i = 0; ( i <= entries && entriesDone <= entries && weatherResponse.data.daily[i] ); i++ ) {
        if ( weatherResponse.data.daily[i].dt < lastDtReported ){
          continue;
        }
        windString = windString + "\n" + openweatherForcastToWindString(weatherResponse.data.timezone_offset, weatherResponse.data.daily[i]);
        entriesDone++
      }
      responses.push(windString)
      return responses
    }
  }
  
  responses.push('Command not recognized, please use one of: hello, openweather alerts, openweather sun, openweather wind')
  return responses
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

let openweatherDateTime = function ( timezone_offset, utcSeconds ) {
  return openweatherDate(timezone_offset, utcSeconds) + " " + openweatherTime(timezone_offset, utcSeconds)
}
// END openweathermap functions

// START general functions

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