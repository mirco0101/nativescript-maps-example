var frameModule = require("ui/frame");

exports.register = function() {
    var topmost = frameModule.topmost();
    topmost.navigate("views/register/register");
};