exports.handler = async (context, event, callback) => {
    // Create a new messaging response object
    const twiml = new Twilio.twiml.MessagingResponse();
    twiml.message(await exports.work(context, ""));
    // Return the TwiML as the second argument to `callback`
    // This will render the response as XML in reply to the webhook request
    return callback(null, twiml);
  };

exports.work = async (messageIn) => {
    return 'Something went wrong, this is a fallback response...';
};