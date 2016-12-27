// fetches robots.txt file - if one exists
// stores it locally in the project directory
// parses it using 'robots-txt-parse' moodule
// and returns an array of banned paths

const url = require('url');
const fs = require('fs');

const rp = require('request-promise');
const parse = require('robots-txt-parse'); // module to scan robots.txt file

function fetchBannedUrls(startingUrl) {

  const urlObject = url.parse(startingUrl);
  const robotsTxtFilePath = url.format({
                          protocol: urlObject.protocol,
                          hostname: urlObject.hostname,
                          pathname: '/robots.txt'
                        });

  let bannedUrls = [];
  const options = {
    uri:  robotsTxtFilePath,
    simple: false,
    resolveWithFullResponse: true,
    gzip: true
  };

  return rp(options)
    .then(response => {
      if(response.statusCode !== 404) {

        // fetching robots.txt using request promise
        fs.writeFile('robots.txt', response.body, (err) => {
          if (err) throw err;
          console.log('robots.txt saved!');
        });

        // parsing robots file into a JSON to read and figure out urls
        // more details about file format here: https://www.npmjs.com/package/robots-txt-parse
        return parse(fs.createReadStream(__dirname + '/robots.txt'))
          .then(robots => {
            for(let i = 0; i < robots.groups.length; i++) {
              if(robots.groups[i].agents.includes('*')){
                const rules = robots.groups[i].rules;
                for(let j = 0; j < rules.length; j++) {
                  if(rules[j].rule.toLowerCase() === 'disallow'){
                    bannedUrls.push(rules[j].path);
                  }
                }
              }
            }
            return bannedUrls;
          })
          .catch(err => console.log(err));
      } else {
        return [];
      }
    })
    .catch(err => console.log(err));

}

module.exports = fetchBannedUrls;