var google = require('googleapis'),
    googleAuth = require('google-auth-library');

if (process.env.REDISTOGO_URL) {
  var rtg   = require('url').parse(process.env.REDISTOGO_URL),
      client = require('redis').createClient(rtg.port, rtg.hostname);
  client.auth(rtg.auth.split(':')[1]);
} else {
  var client = require('redis').createClient();
}

var CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET,
    CLIENT_ID = process.env.GOOGLE_CLIENT_ID,
    REDIRECT_URLS = process.env.GOOGLE_REDIRECT_URLS;

if (!CLIENT_ID || !CLIENT_ID || !REDIRECT_URLS) {
  console.log('Error: Missing either GOOGLE_CLIENT_SECRET, GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URLS env vars');
  process.exit(1);
}

function _getClientSecret (cb) {
  client.get('client_secret', function (err, res) {
    if (err) {
      console.log('An error occurred when getting the client_secret from redis', err);
      return cb(err);
    }
    return cb(null, res);
  });
}

function _authorize (userAuth, cb) {
  var clientSecret = CLIENT_SECRET,
      clientId = CLIENT_ID,
      redirectUrl = REDIRECT_URLS.split('|')[0],
      auth = new googleAuth(),
      oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  if (userAuth) {
    oauth2Client.credentials = JSON.parse(userAuth);
    return cb(null, oauth2Client);
  }

  return cb(oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly']
    }),
    oauth2Client
  );
}

function _getUserAuth (email, cb) {
  client.get('auth:' + email, cb);
}

function _saveUserAuth (email, token, cb) {
  client.set('auth:' + email, JSON.stringify(token), cb);
}

module.exports = {
  saveClientSecret: function (contents, cb) {
    client.set('client_secret', JSON.stringify(contents), cb);
  },
  userIsSaved: function (email, cb) {
    client.get('auth:' + email, cb);
  },
  getNextMeeting: function (email, cb) {
    _getUserAuth(email, function (err, userAuth) {
      _authorize(userAuth, function (err, auth) {
        var calendar = google.calendar('v3');
        calendar.events.list({
          auth: auth,
          calendarId: 'primary',
          timeMin: (new Date()).toISOString(),
          maxResults: 1,
          singleEvents: true,
          orderBy: 'startTime'
        }, cb);
      });
    });
  },
  getAuthUrl: function (cb) {
    _authorize(null, cb);
  },
  saveToken: function (email, code, cb) {
    _authorize(null, function (err, oauth2Client) {
      oauth2Client.getToken(code, function (err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          return cb(err);
        }
        oauth2Client.credentials = token;
        _saveUserAuth(email, token, cb);
      });
    });
  }
};
