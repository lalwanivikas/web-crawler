// takes input from command line
// and parses it into URL object
// returns proper path to start with
// adds https protocol if none is given

const url = require('url');

function parseUrl(userInput) {

  // to accomodate both google.com and https://google.com
  let urlObject = url.parse(userInput);
  if(urlObject.protocol == null) {
    userInput = `https://${userInput}`;
  }
  urlObject = url.parse(userInput);

  // forming new url from userInput
  const domainToCrawl = url.format({
    protocol: urlObject.protocol,
    hostname: urlObject.hostname,
    pathname: urlObject.pathname
  });

  return domainToCrawl;

}

module.exports = parseUrl;