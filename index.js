const fs = require('fs');
const url = require('url');
const argv = require('yargs').argv; // for taking arguments from command line


const parseUrl = require('./parseUrl'); // parses the initial url passed by user
const crawlSinglePage = require('./crawlSinglePage'); // crawls a single url and returns its data
const fetchBannedUrls = require('./robots'); // checks robots.txt for pages banned for crawlers


const urlPool = {}; // contains all the urls. Format - "url": crawledOrNot - {'abc.com': false}
let crawledUrls = []; // contains all the crawled urls
let output = []; // contains output of all pages
let bannedUrls = []; // contains all the paths banned by robots.txt


// Batch data
// urls are processed in a batch defined by batchSizeLimit
// only if a batch is processed, new batch will begin
let batchSizeLimit; // size of a batch - can be set via command line
let batchSize = 0; // number of urls in current batch
let currentBatch = {}; // urls in current batch. Same format as urlPool
let batchInProgress = false; // flag to see if a batch is being processed


// a batch gets only five tries before next one begins
// that's why you shoud not keep very high batch size
let numberOfTries = 0;


// checks if a url is allowed to be crawled
// or if it is banned bt robots.txt
function isUrlAllowed(hyperlink) {
  const urlPath = url.parse(hyperlink).pathname;
  for(let i = 0; i < bannedUrls.length; i++) {
    if(urlPath.startsWith(bannedUrls[i])){
      return false;
    }
  }
  return true;
}


// ** heart of the crawler **
// - sends individual urls for crawling through crawlSinglePage function
// - updates the output array with new data
// - maintains status of urlPool
function processUrlPool(urlPool) {

  // before sending new batch for crawling
  // make sure current batch is processed
  // each batch gets 5 tries
  // if all urls are not prcessed with in 5 tries, batch is cleared
  let batchStatus = Object.keys(currentBatch).map(u => currentBatch[u]); // stores status of current batch in the form of true or false flags
  if(batchStatus.indexOf(false) > -1 && numberOfTries < 5) { // if even 1 false is present, it means the batch is being processed
    batchInProgress = true;
    numberOfTries++;
    return;
  } else {
    numberOfTries = 0;
    clearUnreachableUrls(currentBatch);
    batchInProgress = false;
    batchSize = 0;
    currentBatch = {};
    batchStatus = [];
    // writing to output
    // so even if user stops the process
    // he or she can view the result till that point
    fs.writeFile('output.json', JSON.stringify(output, null, 2), (err) => {
      if (err) throw err;
    });
  }

  for(uri in urlPool) {

    // if a url has not been processed and batch has some space
    // add the uri to the batch and send it for crawling
    if(!urlPool[uri] && batchSize < batchSizeLimit) {

      currentBatch[uri] = false;
      batchSize++;
      batchInProgress = true;

      crawlSinglePage(uri)
        .then(singlePageData => {

          // updating status of current uri in urlPool
          if(singlePageData) {
            urlPool[singlePageData.uri] = true;
            currentBatch[singlePageData.uri] = true;
          }

          // updating urlPool with newly discoverd links
          const newHyperlinks = singlePageData.internalHyperlinks;
          for(let i = 0, len = newHyperlinks.length; i < len; i++) {
            if(!(newHyperlinks[i] in urlPool) && isUrlAllowed(newHyperlinks[i])) {
              if(!(newHyperlinks[i].slice(0, - 1) in urlPool)) { // to take care of trailing slashes
                urlPool[newHyperlinks[i]] = false;
              }
            }
          }

          // updating output array with new page data
          if(!crawledUrls.includes(singlePageData.uri)) {
            crawledUrls.push(singlePageData.uri);
            output.push({
              uri: singlePageData.uri,
              assets: singlePageData.assets
            });
          }
        })
        .catch((error) => console.log(error));

    }

  }
}

// called in case of batch has been tried enough times
// urls in that batch are marked true
function clearUnreachableUrls(currentBatch) {
  for(page in currentBatch) {
    if(!urlPool[page.uri]) {
      urlPool[page.uri] = true;
    }
  }
};


// this gets called every 5 seconds to check the status of the crawl
// if all the urls in the pool have been crawled, it returns the output
// if not it calls the processUrlPool function
function checkCrawlingStatus() {

  const urlPoolStatus = Object.keys(urlPool).map(u => urlPool[u]); // url pool status contains true or false depending on if a url has been processed
  const allUrlsProcessed = urlPoolStatus.indexOf(false) === -1 ? true : false; // even if there is one false, crawling is still in progress
  if(!allUrlsProcessed) {
    processUrlPool(urlPool);
    setTimeout(checkCrawlingStatus, 5000);
  } else {
    fs.writeFile('output.json', JSON.stringify(output, null, 2), (err) => {
      if (err) throw err;
      console.log('Output saved! Check your local directory for output.json');
      process.exit();
    });
  }

  // updating the status on the console
  const urlsCrawled = output.length;
  console.log("Total pages found\t", Object.keys(urlPool).length);
  console.log("Total pages crawled\t", urlsCrawled);
  console.log('=============================');

}


// does initial setup
// and starts the crawling process
function init() {

  // sets up first url to crawl
  const startingPath = parseUrl(argv.domain);
  urlPool[startingPath] = false;

  // parses batch size from command line
  batchSizeLimit = argv.batch || 5;

  // reads robots.txt
  // and stores banned urls in bannedUrls array
  fetchBannedUrls(startingPath)
    .then(data => {
      bannedUrls = data;
    })
    .catch(() => {
      bannedUrls = []
    })

  // starts the crawling process
  setTimeout(checkCrawlingStatus, 5000);

}

init();