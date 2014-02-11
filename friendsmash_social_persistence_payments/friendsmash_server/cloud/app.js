
// These two lines are required to initialize Express in Cloud Code.
var express = require('express');
var app = express();

// Global app configuration section
app.use(express.bodyParser());    // Middleware for reading request body

app.all('/callback2', function(req,res) {
  console.log('callback');
  if( req.param('hub.verify_token') ) {
    if( req.param('hub.verify_token') == 'YOUR_VERIFY_TOKEN' ) {
      sendResponse = req.param('hub.challenge');
      res.send(sendResponse);
    } else {
      res.send(403);
    }
  } else {
    if( req.body.object ) {
      if( req.body.object == 'payments' ) {
        console.log('RTU received for payment ID: ' + req.body.entry[0].id );
        Parse.Cloud.useMasterKey();
        var query = new Parse.Query(Parse.User);
        query.equalTo('fbid', req.body.entry[0].id);
        query.first({
          success: function(user) {
            if (user) {
              Parse.User.become(user.getSessionToken()).then( function(user) {
                Parse.Cloud.run('fulfilPayment', {
                  payment_id: req.body.entry[0].id
                }).then( function(result) {
                  res.send(200);
                }, function(error) {
                  console.log(error.message);
                  res.send(500);
                });
              }, function(error){
                console.log(error.message);
                res.send(500);
              });
            } else {
              response.error('No user object found for this payment uid');
            }
          },
          error: function(error) {
            response.error('Error finding user: ' + error.message);
          }
        });
      }
    } else {
      console.log('RTU broken.');
      console.log(req.body);
      res.send(sendResponse);
    }
  }
});

app.all('/callback', function(req,res) {
  if( req.param('hub.verify_token') ) {
    if( req.param('hub.verify_token') == 'YOUR_VERIFY_TOKEN' ) {
      res.send( req.param('hub.challenge') );
    } else {
      res.send(403);
    }
    return;
  }
 
  if (!req.body.object || req.body.object !== 'payments') {
    console.log('Error parsing RTU payments object.');
    console.log(req.body);
    res.send(500);
    return;
  }
 
  Parse.Cloud.useMasterKey();
  var query = new Parse.Query(Parse.User);
  query.equalTo('fbid', req.body.entry[0].id);
  query.first().then(function(user) {
    if (!user) {
      return Parse.Promise.error({
        message: 'No user object found for this payment uid'
      });
    }
    return Parse.User.become(user.getSessionToken());
  }).then(function(result) {
    return Parse.Cloud.run('fulfilPayment', { payment_id: req.body.entry[0].id });
  }).then(function() {
    res.send(200);
  }, function(error) {
    console.log(error.message);
    res.send(500);
  });
});

// Attach the Express app to Cloud Code.
app.listen();
