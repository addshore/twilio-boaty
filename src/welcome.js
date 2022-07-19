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
        if (weatherResponse.data.alerts.length == 0) {
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
        let sunrise = new Date(weatherResponse.data.current.sunrise);
        let sunset = new Date(weatherResponse.data.current.sunset);
        return "Sunrise: " + sunrise.toString() + ", Sunset: " + sunset.toString()
      }
    }
    }
  } else {
    return 'Command not recognized, please use one of: debug, hello, bye, openweather sun, openweather alerts';
  }
}