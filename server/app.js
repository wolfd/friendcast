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
var models = require("../models");

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Setup app.
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(multer());

// Accept Facebook auth.
app.post('/auth', function(req, res) {
    if (req.body.access_token) {
        graph.setAccessToken(req.body.access_token);
        res.sendStatus(201);
    }
});

// Init Facebook API.
graph.setAppSecret(process.env.FACEBOOK_APP_SECRET);

app.post('/cast', function(req, res) {

});

// Obtain friends.
app.post('/', function(req, res) {
    graph.get("/me/friends",  function(err, fb) {
        if (fb.data) {
            res.json(fb.data);
        } else {
            fb.sendStatus(500);
        }
    });
});

models.sequelize.sync().then(function () {
  var server = app.listen(app.get('port'), function() {
    debug('Express server listening on port ' + server.address().port);
  });
  server.on('error', onError);
  server.on('listening', onListening);

  function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    debug('Listening on ' + bind);
  }
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
