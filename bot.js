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
    } else {
      console.log('Connected to RTM')
    }
  });
}

connect();

controller.hears(
  ['(where|when) is my next meeting\??'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var email = message.user;
    helpers.userIsSaved(email, function (err, res) {
      if (err) {
        return bot.reply(message, 'Something happened when I was looking for your details :(');
      }
      if (!res) {
        helpers.getAuthUrl(function (url) {
          return bot.reply(message, 'I don\'t have your details yet, please authorize by going to this url: ' + url + '\nThen PM me with the following message: "Here is my token: <token>"');
        });
      }
      helpers.getNextMeeting(email, function (err, res) {
        if (err) {
          return bot.reply(message, 'Something happened when I was looking for your meeting :(');
        }
        if (res.items.length === 0) {
          return bot.reply(message, 'I couldn\'t find any events in your calendar :o!');
        }
        var meeting = res.items[0],
            location = meeting.location,
            startsIn = moment().to(meeting.start.dateTime);
        if (location) {
          var result = 'It\'s @ *' + location + '* ' + startsIn + ' - Summary: ' + meeting.summary;
        } else {
          var result = 'It\'s ' + startsIn + ' - Summary: ' + meeting.summary;
        }
        return bot.reply(message, result);
      });
    });
  }
);

controller.hears(
  ['Here is my token: (.*)'],
  ['direct_message'],
  function (bot, message) {
    var code = message.match[1];
    var email = message.user;
    helpers.saveToken(email, code, function (err, res) {
      if (err) {
        return bot.reply(message, err.toString());
      }
      return bot.reply(message, 'Cool, thanks. I have saved your information for the next time!');
    });
  }
);
