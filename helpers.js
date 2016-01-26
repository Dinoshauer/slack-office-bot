var google = require('googleapis'),
    googleAuth = require('google-auth-library');

if (process.env.REDISTOGO_URL) {
  var rtg   = require('url').parse(process.env.REDISTOGO_URL),
      client = require('redis').createClient(rtg.port, rtg.hostname);
  client.auth(rtg.auth.split(':')[1]);
} else {
  var client = require('redis').createClient();
}

function _getClientSecret (cb) {
  client.get('client_secret', function (err, res) {
    if (err) {
      console.log('An error occurred when getting the client_secret from redis', err);
      cb(err);
    }
    cb(null, res);
  });
}

function _authorize (userAuth, cb) {
  _getClientSecret(function (err, res) {
    var data = JSON.parse(res),
        clientSecret = data.installed.client_secret,
        clientId = data.installed.client_id.split('|')[0].replace(/https?:\/\//g, ''),
        redirectUrl = data.installed.redirect_uris[0],
        auth = new googleAuth(),
        oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    if (userAuth) {
      oauth2Client.credentials = JSON.parse(userAuth);
      cb(null, oauth2Client);
    }

    cb(oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.readonly']
      }),
      oauth2Client
    );
  });
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
          cb(err);
        }
        oauth2Client.credentials = token;
        _saveUserAuth(email, token, cb);
      });
    });
  }
};
