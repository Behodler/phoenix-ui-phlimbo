function handler(event) {
  var req = event.request;
  // Treat any path without a file extension as an SPA route and
  // rewrite to /index.html. Real assets (.js, .css, .png, .svg, .json,
  // .map, .ico, .woff2 etc.) are passed through untouched.
  if (req.uri !== '/' && !req.uri.includes('.')) {
    req.uri = '/index.html';
  }
  return req;
}
