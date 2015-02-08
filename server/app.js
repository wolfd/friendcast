var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
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
  server.on('error', onError);
  server.on('listening', onListening);

  function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
  }
});

// Receive availability from user client.
app.post('/cast', function(req, res) {
    var fbUserId = null;

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
    }

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb.id) {
            fbUserId = fb.id;
        } else {
            res.sendStatus(500);
        }
    });

    // Create db record.
    models.Free.create({
        fb_user_id: fbUserId,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        blurb: req.body.blurb,
        done: false
    }).on('success', function() {
        res.sendStatus(200);
    });
});

// Obtain friends.
app.post('/reel', function(req, res) {

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
    }

    // Grab friend ids from Facebook.
    var friendIds = new Array();
    var friendFirstNames = new Array();
    var friendLastNames = new Array();
    graph.get("/me/friends",  function(err, fb) {
        if (fb.data) {
            for (var i = 0; i < fb.data.length; i++) {
                friendIds[friendIds.length] = fb.data[i].id;
                friendFirstNames[friendFirstNames.length] = fb.data[i].name.split(" ")[0];
                friendLastNames[friendLastNames.length] = fb.data[i].name.split(" ")[1];
            }
        } else {
            res.sendStatus(500);
        }
    });

    // Find avaiable friends.
    models.Free.findAll({ where: { fb_user_id: { in: friendIds } } })
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

app.post('/bye', function(req, res) {
    var fbUserId = null;

    // Set access token for Facebook.
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
    } else {
        res.sendStatus(500);
    }

    // Obtain personal ID from Facebook.
    graph.get("/me", function(err, fb) {
        if (fb.id) {
            fbUserId = fb.id;
        } else {
            res.sendStatus(500);
        }
    });

    models.Free.find({ where: { fb_user_id: { in: [fbUserId] } } }).then(function(record) {
        record.destroy().on('success', function(result) {
            if (result && result.deletedAt) {
                res.sendStatus(200);
            }
        });
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

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('YOU UCKED FUP.');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;
