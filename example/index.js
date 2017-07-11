var express = require('express');
var app = express();
app.use(express.static('public'));
app.listen(3300, function () {
  console.log('Example app listening on port 3300!');
});