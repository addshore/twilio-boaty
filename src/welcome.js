const axios = require('axios');
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
          let tz = weatherResponse.data.timezone
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
      let dayMatcher = messageIn.match(/(sun|moon) (\d+)/);
      let days = 2
      if (dayMatcher != null) {
        days = dayMatcher[2]
        if(days > 10) {
          // Don't allow more than 10 days (5 sms ish)
          days = 10
        }
      }
      let tz = weatherResponse.data.timezone
      let sunString = "";
      for(let i = 0; i < days; i++) {
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
  }
  
  responses.push('Command not recognized, please use one of: hello, openweather alerts, openweather sun')
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
let openweatherTime = function( timezone, utcSeconds ) {
  let dateObject = new Date(0)
  dateObject.setUTCSeconds(utcSeconds)
  let timeOptions = {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute:'2-digit'
  }
  return dateObject.toLocaleTimeString("en-US", timeOptions)
}

let openweatherDate = function( timezone, utcSeconds ) {
  let dateObject = new Date(0)
  dateObject.setUTCSeconds(utcSeconds)
  let dateOptions = {
    timeZone: timezone,
    day: 'numeric',
    month: 'short'
  }
  return dateObject.toLocaleDateString("en-US", dateOptions)
}

let openweatherDateTime = function ( timezone, utcSeconds ) {
  return openweatherDate(timezone, utcSeconds) + " " + openweatherTime(timezone, utcSeconds)
}
// END openweathermap functions