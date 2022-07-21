const axios = require('axios');

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.MessagingResponse();

  twiml.message(await exports.work(context, event.Body.toLowerCase()))

  // Return the TwiML as the second argument to `callback`
  // This will render the response as XML in reply to the webhook request
  return callback(null, twiml);
};

exports.work = async (context, messageIn) => {
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
      return 'Extracted URL: ' + inreachData.url + ', lat: ' + inreachData.lat + ', lon: ' + inreachData.lon + ' from the inReach URL'
    } else if ( hasInreachLink ) {
      return 'No data extracted from URL: ' + inreachLink
    } else {
      return 'No inreach link detected'
    }
  }

  // Very basic hellow goodbye test commands
  if ( messageIn.startsWith('hello') ) {
    return 'Hello, there!';
  }

  // openweather
  if ( messageIn.startsWith('openweather') ) {
    // If we have no inreach link, tell the user to submit locations
    if ( !inreachData ) {
      return "openweather requested, but no inreach link found. Please enable loction in your messages!"
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
      return "Error retrieving weather infomation from openweathermap.org"
    }

    // openweather alerts
    if ( messageIn.startsWith('openweather alerts') ) {
      if (!weatherResponse.data.alerts || weatherResponse.data.alerts.length == 0) {
        return 'No weather alerts for your area';
      } else {
        var msg = ""
        for (let i = 0; i < weatherResponse.data.alerts.length; i++) {
          let alert = weatherResponse.data.alerts[i]
          msg = msg + i + ") " + alert.sender_name + " " + alert.event + " " + alert.start + "/" + alert.end + "\n"
        }
        return msg
      }
    }
    
    // openweather sun / moon
    if ( messageIn.startsWith('openweather sun') || messageIn.startsWith('openweather moon') ) {
      var todaySunrise = new Date(0);
      todaySunrise.setUTCSeconds(weatherResponse.data.daily[0].sunrise);
      let todaySunset = new Date(0);
      todaySunset.setUTCSeconds(weatherResponse.data.daily[0].sunset);

      var todayMoonrise = new Date(0);
      todayMoonrise.setUTCSeconds(weatherResponse.data.daily[0].moonrise);
      let todayMoonset = new Date(0);
      todayMoonset.setUTCSeconds(weatherResponse.data.daily[0].moonset);

      var tomorrowSunrise = new Date(0);
      tomorrowSunrise.setUTCSeconds(weatherResponse.data.daily[1].sunrise);
      let tomorrowSunset = new Date(0);
      tomorrowSunset.setUTCSeconds(weatherResponse.data.daily[1].sunset);

      var tomorrowMoonrise = new Date(0);
      tomorrowMoonrise.setUTCSeconds(weatherResponse.data.daily[1].moonrise);
      let tomorrowMoonset = new Date(0);
      tomorrowMoonset.setUTCSeconds(weatherResponse.data.daily[1].moonset);

      let timeOptions = {
        timeZone: weatherResponse.data.timezone,
        hour12: false,
        hour: '2-digit',
        minute:'2-digit'
      }

      let dateOptions = {
        timeZone: weatherResponse.data.timezone,
        day: 'numeric',
        month: 'short'
      }

      return todaySunrise.toLocaleDateString("en-US", dateOptions) + " (today): " +
        "Sun: " + todaySunrise.toLocaleTimeString("en-US", timeOptions) + " -> " + todaySunset.toLocaleTimeString("en-US", timeOptions) +
        ", Moon (phase " + weatherResponse.data.daily[0].moon_phase + "): " + todayMoonrise.toLocaleTimeString("en-US", timeOptions) + " -> " + todayMoonset.toLocaleTimeString("en-US", timeOptions) +
        "\n" +
        tomorrowSunrise.toLocaleDateString("en-US", dateOptions) + ": " +
        "Sun: " + tomorrowSunrise.toLocaleTimeString("en-US", timeOptions) + " -> " + tomorrowSunset.toLocaleTimeString("en-US", timeOptions) +
        ", Moon (phase " + weatherResponse.data.daily[0].moon_phase + "): " + tomorrowMoonrise.toLocaleTimeString("en-US", timeOptions) + " -> " + tomorrowMoonset.toLocaleTimeString("en-US", timeOptions);

      }
  }
  
  return 'Command not recognized, please use one of: hello, openweather alerts, openweather sun'
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