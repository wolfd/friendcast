var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var graph = require('fbgraph');

// Init app.
var app = express();
var models = require("./models");

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Setup app.
app.use(logger('dev'));
//app.use(bodyParser.json());
var urlEncodedParser = bodyParser.urlencoded({ extended: false });
app.use(cookieParser());

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
app.post('/cast', urlEncodedParser, function(req, res) {

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
        res.end();
    }

    console.log(req.body);

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb) {
            console.log(fb);
            // Create db record.
            models.Free.find(fb.id).then(function(record) {
                if (record) {
                    // TODO update would go here....
                } else {
                    models.Free.create({
                        fb_user_id: fb.id,
                        start_time: req.body.start_time,
                        end_time: req.body.end_time,
                        blurb: req.body.blurb,
                        done: false
                    });
                    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
                    res.end();
                }
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
app.post('/reel', urlEncodedParser, function(req, res) {

    console.log(req.body);

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
        res.end();
    }

    // Grab friend ids from Facebook.
    graph.get("/me/friends",  function(err, fb) {
        var friendIds = [];
        for (var i = 0; i < fb.data.length; i++) {
            friendIds.push(fb.data[i].id);
        }
        console.log(friendIds);



        // Obtain personal ID from Facebook.
        graph.get("/me", function(err, fb) {
            var myStartTime = null;
            var myEndTime = null;

            if (fb.id) {
                models.Free.find({where: { fb_user_id: fb.id }}).then(function(myAccount) {
                    if (myAccount) {
                        myStartTime = myAccount.getDataValue('start_time');
                        myEndTime = myAccount.getDataValue('end_time');

                        // Find available friends.
                        // x1 <= y2 && x2 > y1
                        models.Free.findAll({ where: models.Sequelize.and({ fb_user_id: { in: friendIds } },
                            models.Sequelize.and({start_time: { lte: myEndTime }}, {end_time: { gt: myStartTime }}))})
                            .then(function(records) {

                            console.log(records);

                            var jsonObject = {};
                            jsonObject["friends"] = [];
                            for (var i = 0; i < records.length; i++) {
                                jsonObject["friends"][i] = {};
                                var currFriend = jsonObject["friends"][i];

                                graph.get("/" + records[i].dataValues.fb_user_id, function(err, fb) {
                                    if (fb.id) {
                                        currFriend["first_name"] = fb.first_name;
                                        currFriend["last_name"] = fb.last_name;
                                    }

                                    if (records) {
                                        currFriend["start_time"] = records[i].dataValues.start_time;
                                        currFriend["end_time"] = records[i].dataValues.end_time;
                                        currFriend["blurb"] = records[i].dataValues.blurb;
                                    }
                                });
                            }

                            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
                            res.end(JSON.stringify(jsonObject));
                        });
                    }
                });
            } else {
                console.error(err);
                res.end();
            }
        });
    });
});

/*
Clears your database record after finding a friend or end_time.

NEEDS:
- access_token
*/
app.post('/bye', urlEncodedParser, function(req, res) {

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
        res.end();
    }

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb.id) {
            models.Free.find({ where: { fb_user_id: { in: [fb.id] } } }).then(function(record) {
                if (record) {
                    record.destroy().on('success', function(result) {
                        if (result && result.deletedAt) {
                            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
                            res.sendStatus(200);
                            res.end();
                        }
                    });
                } else {
                    console.error("no record found to delete");
                    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
                    res.end();
                }
            });
        } else {
            console.error("bye error: " + err);
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
            res.end();
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
