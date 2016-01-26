var Botkit = require('botkit'),
    moment = require('moment'),
    helpers = require('./helpers');

if (!process.env.SLACK_API_KEY) {
  console.log('Error: Specify SLACK_API_KEY in environment');
  process.exit(1);
}

var controller = Botkit.slackbot(),
    bot = controller.spawn({
      token: process.env.SLACK_API_KEY
    });

function connect() {
  bot.startRTM(function (err, bot, payload) {
    if (err) {
      console.log('Could not connect to slack due to: ', err);
      setTimeout(connect(), 5000);
    }
  });
}

connect();

controller.hears(
  ['(where|when) is my next meeting\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    bot.api.users.info(message, function (err, response) {
      if (err) {
        bot.reply(message, 'I couldn\'t get your user information, sorry!');
      }
      var email = response.user.profile.email;
      helpers.userIsSaved(email, function (err, res) {
        if (err) {
          bot.reply(message, 'Something happened when I was looking for your details :(');
        }
        if (!res) {
          helpers.getAuthUrl(function (url) {
            bot.reply(message, 'I don\'t have your details yet, please authorize by going to this url: ' + url + '\nThen PM me with the following message: "Here is my token: <token>"');
          });
        }
        helpers.getNextMeeting(email, function (err, res) {
          if (err) {
            bot.reply(message, 'Something happened when I was looking for your meeting :(');
          }
          if (res.items.length === 0) {
            bot.reply(message, 'I couldn\'t find any events in your calendar :o!');
          }
          var meeting = res.items[0],
              location = meeting.location,
              startsIn = moment().to(meeting.start.dateTime);
          if (location) {
            var result = 'It\'s @ *' + location + '* ' + startsIn + ' - Summary: ' + meeting.summary;
          } else {
            var result = 'It\'s ' + startsIn + ' - Summary: ' + meeting.summary;
          }
          bot.reply(message, result);
        });
      });
    });
  }
);

controller.hears(
  ['Here is my token: (.*)'],
  ['direct_message'],
  function (bot, message) {
    var code = message.match[1];

    bot.api.users.info(message, function (err, response) {
      if (err) {
        bot.reply(message, 'I couldn\'t get your user information, sorry!');
        return;
      }
      var email = response.user.profile.email;
      helpers.saveToken(email, code, function (err, res) {
        if (err) {
          bot.reply(message, err.toString());
          return;
        }
        bot.reply(message, 'Cool, thanks. I have saved your information for the next time!');
      });
    });
  }
);

controller.hears(
  ['setup'],
  ['direct_message'],
  function (bot, message) {
    bot.startConversation(message, function (err, convo) {
      convo.say('Warning this will overwrite your client_secret details if you have already provided them!');
      convo.ask('Please paste the contents of the "client_secret" JSON file here. (Cancel with "no")', [
        {
          pattern: bot.utterances.no,
          callback: function (response, convo) {
            convo.say('Alright buddy! Consider it cancelled!');
            convo.next();
          }
        },
        {
          default: true,
          callback: function(response, convo) {
            try {
              helpers.saveClientSecret(
                client,
                JSON.parse(response.text.replace(/<|>/g, '')),
                function (err, res) {
                  if (err) {
                    convo.say('Something bad happened when I tried to save the info :(');
                    console.log(err);
                    convo.next();
                  }
                  convo.say('Thanks! I have saved the contents in my brain.');
                }
              );
            } catch (exc) {
              console.log(exc);
              convo.say('It doesn\'t seem like that is valid JSON! I threw an exception at least.');
              convo.repeat();
            }
            convo.next();
          }
        }
      ]);
    });
  }
);
