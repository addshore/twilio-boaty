const axios = require('axios');

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.MessagingResponse();

  twiml.message(await exports.work(context, event.Body.toLowerCase()))

  // Return the TwiML as the second argument to `callback`
  // This will render the response as XML in reply to the webhook request
  return callback(null, twiml);
};


exports.work = async (context, messageIn) => {
  const debug = messageIn.includes('debug')
  if (debug) {
    console.log(JSON.stringify(messageIn))
  }

  const hasInreachLink = messageIn.includes('inreachlink.com')

  //////////////////////////////////////////////////////////
  // Extract data from an inreach link if it exists...
  //////////////////////////////////////////////////////////
  var d = false;
  if (hasInreachLink) {
    var url = messageIn.match(/(inreachlink.com[^ ]*)/)[1];
    if (debug) {
      console.log(url)
    }
    const response = await axios
      .get("https://" + url)
      .catch((error) => {
        // Be sure to handle any async errors, and return them in callback to end
        // Function execution if it makes sense for your application logic
        console.error(error);
      });
    if ( response && response.data ) {
      // Matching lines from some JS that is loaded on the page
      // The starts of lines are provided for convenience
      // User : {"Id":585830,"AssignedDeviceId":null,"Has ..........
      var extractedUser = JSON.parse(response.data.match(/User\s*:\s*({.*})/i)[1])
      // data: {"L":51.296935,"N":-2.140708,"A":89.77,"G":1.0000,
      var extractedData = JSON.parse(response.data.match(/data\s*:\s*({.*})/i)[1])
      if (debug) {
        console.log(JSON.stringify(extractedUser))
        console.log(JSON.stringify(extractedData))
      }
      var d = {
        url: url,
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
      if (debug) {
        console.log(JSON.stringify(d))
      }
    }
  }

  //////////////////////////////////////////////////////////
  // Decide on a message to send
  //////////////////////////////////////////////////////////
  if ( messageIn.startsWith('debug') ) {
    if( hasInreachLink && d ) {
      return 'Extracted URL: ' + d.url + ', lat: ' + d.lat + ', lon: ' + d.lon + ' from the inreach URL'
    } else if ( hasInreachLink ) {
      return 'No data extracted from URL: ' + url
    } else {
      return 'No inreach link detected'
    }
  } else if ( messageIn.startsWith('hello') ) {
    return 'Hello, there!';
  } else if ( messageIn.startsWith('bye') ) {
    return 'Goodbye!';
  } else if ( messageIn.startsWith('openweather') ) {
    if ( !d ) {
      return "openweather requested, but no coordiates provided"
    } else {
    // https://openweathermap.org/api/one-call-api
    const weatherResponse = await axios
      .get("https://api.openweathermap.org/data/2.5/onecall?lat=" + d.lat + "&lon=" + d.lon + "&appid=" + context.OPENWEATHERMAP_KEY)
      .catch((error) => {
        // Be sure to handle any async errors, and return them in callback to end
        // Function execution if it makes sense for your application logic
        console.error(error);
      });
    if ( weatherResponse && weatherResponse.data ) {
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
      } else if ( messageIn.startsWith('openweather sun') ) {
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
    }
  } else {
    return 'Command not recognized, please use one of: debug, hello, bye, openweather sun, openweather alerts';
  }
}