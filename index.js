const message = process.argv.slice(2).join(" ");

// Context can be empty as we mock all requests
const context = {}

// Setup an axious mock
// https://www.npmjs.com/package/axios-mock-adapter
var axios = require("axios");
var MockAdapter = require("axios-mock-adapter");
var mock = new MockAdapter(axios);

var fs = require('fs');
var mockDirectories = fs.readdirSync('./mock/');
console.log("-----------------------------------")
console.log("Loading mock data...")
mockDirectories.forEach(dicrectory => {
    var mockFiles = fs.readdirSync('./mock/' + dicrectory + '/')
    mockFiles.forEach(file => {
        var mockFilePath = './mock/' + dicrectory + '/' + file
        var data = fs.readFileSync(mockFilePath)
        mock.onGet("https://" + file.replace(/_/g,'/')).reply(200, data.toString());
        console.log("https://" + file.replace(/_/g,'/'))
    })
});

console.log("-----------------------------------")
console.log("Attempting request...");
console.log("Message: " + message);
console.log("-----------------------------------");
console.log("Message responses...");

(async function () {
    try {
        const { work: welcome } = require('./src/welcome.js')
        console.log(await welcome(context, message))
    } catch (err) {
        console.log(err)
        console.log('--------------------------------------------------')
        console.log('Falling back...')
        console.log('--------------------------------------------------')
        const { work: fallback } = require('./src/fallback.js')
        console.log(await fallback(context, message))
    } finally {
    }
})();