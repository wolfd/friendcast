var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var graph = require('fbgraph');
var multer = require('multer');

// Init app.
var app = express();
var models = require("./models");

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Setup app.
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(multer());

// Init Facebook API.
graph.setAppSecret(process.env.FACEBOOK_APP_SECRET);

// Init database middleware.
models.sequelize.sync().then(function () {
  var server = app.listen(app.get('port'), function() {});
  server.on('listening', onListening);

  function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
  }
});

/*
Receive availability from user client.

NEEDS:
- access_token (facebook personal token)
- start_time (time in seconds)
- end_time (time in seconds)
- blurb (brief text)
*/
app.post('/cast', function(req, res) {

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
    }

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb.id) {
            var fbUserId = fb.id;
            console.log(fbUserId);

            // Create db record.
            models.Free.findOrCreate({ where: { fb_user_id: fbUserId }, defaults: {
                fb_user_id: fbUserId,
                start_time: req.body.start_time,
                end_time: req.body.end_time,
                blurb: req.body.blurb,
                done: false
            }}).spread(function(user, created) {
                if (created) {
                    console.log("db record created");
                } else {
                    console.log("db record updated");
                }
                res.sendStatus(200);
            });
        } else {
            console.error(err);
        }
    });
});

/*
Obtain available friends.

NEEDS:
- access_token (facebook personal token)

PROVIDES:
- List of available friends
- [first_name]
- [last_name]
- [start_time]
- [end_time]
- [blurb]
*/
app.post('/reel', function(req, res) {

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        throw error;
    }

    // Grab friend ids from Facebook.
    var friendIds = new Array();
    graph.get("/me/friends",  function(err, fb) {
        if (fb.data) {
            for (var i = 0; i < fb.data.length; i++) {
                friendIds[friendIds.length] = fb.data[i].id;
            }
        } else {
            console.error(err);
        }
    });

    var myStartTime = null;
    var myEndTime = null;

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb.id) {
            models.Free.find({where: { fb_user_id: fb.id }}).then(function(myAccount) {
                myStartTime = myAccount["start_time"];
                myEndTime = myAccount["end_time"];
            });
        } else {
            console.error(err);
        }
    });

    // Find available friends.
    models.Free.findAll({ where: { fb_user_id: { in: friendIds }, start_time: { lte: myStartTime }, end_time: { gte: myEndTime } } })
        .then(function(records) {

        var jsonObject = {};
        jsonObject["friends"] = new Array();
        for (var i = 0; i < records.length; i++) {
            var currFriend = jsonObject["friends"][i];

            graph.get("/" + records["fb_user_id"], function(err, fb) {
                if (fb.id) {
                    currFriend["first_name"] = fb.first_name;
                    currFriend["last_name"] = fb.last_name;
                }
            });

            currFriend["start_time"] = records["start_time"];
            currFriend["end_time"] = records["end_time"];
            currFriend["blurb"] = records["blurb"];
        }

        res.send(JSON.stringify(jsonObject));
    });
});

/*
Clears your database record after finding a friend or end_time.

NEEDS:
- access_token
*/
app.post('/bye', function(req, res) {

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
    }

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb.id) {
            models.Free.find({ where: { fb_user_id: { in: [fb.id] } } }).then(function(record) {
                if (record) {
                    record.destroy().on('success', function(result) {
                        if (result && result.deletedAt) {
                            res.sendStatus(200);
                        }
                    });
                } else {
                    console.error("no record found to delete");
                }
            });
        } else {
            console.error(err);
        }
    });
});

/** ~~~~~~~~~~ +++++++++++ ~~~~~~~~~~ **/

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

module.exports = app;
