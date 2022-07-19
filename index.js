const message = process.argv.slice(2).join(" ");

const context = require ("./context-private.json");

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