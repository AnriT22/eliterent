var fs = require('fs');
try { JSON.parse(fs.readFileSync('lang/en.json','utf8')); console.log('en.json OK'); } catch(e) { console.error('en.json ERROR:', e.message); }
try { JSON.parse(fs.readFileSync('lang/ka.json','utf8')); console.log('ka.json OK'); } catch(e) { console.error('ka.json ERROR:', e.message); }
