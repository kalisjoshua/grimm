
var assert          = require("chai").assert,
    CORELogger      = require("corelogger"),
    express         = require("express"),
    Handlebars      = require("hbs"),
    http            = require("http"),
    path            = require("path"),

    app             = express(),
    Grimm           = require("grimm");

describe("Grimm Framework", function () {
  var validConfig = {
    app: app,
    engine: express,
    env: require("../../../config/dev.json"),
    root: __dirname + "/../../..",
    server: http.createServer(app),
    socketio: require("socket.io"),
    templating: Handlebars
  };

  var grimm = new Grimm(validConfig);

  describe("Instantiation", function () {
    it("should be a function", function () {
      assert.isFunction(Grimm, "Grimm is available");
    });

    it("should throw errors with no config object passed in", function () {
      assert.throws(function () {
        var test = new Grimm();
        test.log();
      }, "Required configuration object not provided to Grimm constructor.");
    });

    it("should throw errors with an empty config object", function () {
      assert.throws(function () {
        var test = new Grimm({});
        test.log();
      }, "Required configuration property [app] not provided to Grimm constructor.");
    });

    it("should throw errors when config.app is not 'express'-like", function () {
      assert.throws(function () {
        var test = new Grimm({
              app: null,
              engine: express,
              env: true,
              root: __dirname,
              server: http.createServer(app),
              socketio: require("socket.io"),
              templating: Handlebars
            });
        test.log();
      }, "Required configuration property [app] not provided to Grimm constructor.");

      assert.throws(function () {
        var test = new Grimm({
              app: {put: []},
              engine: express,
              env: true,
              root: __dirname,
              server: http.createServer(app),
              socketio: require("socket.io"),
              templating: Handlebars
            });
        test.log();
      }, "Required method/property not available on config.app: delete");
    });

    it("should throw errors when given an invalid logger", function () {
      assert.throws(function () {
        var test = new Grimm({
              app: app,
              engine: express,
              env: true,
              logger: true,
              root: __dirname,
              server: http.createServer(app),
              socketio: require("socket.io"),
              templating: Handlebars
            });
        test.log();
      }, TypeError);
    });

    it("should confirm configuration properties", function () {
      assert.equal(path.resolve(__dirname + "/../../.."), grimm.root, "grimm.root should return the path passed into the constructor, run through path.resolve.");

      grimm.setLogger({getLevels: function () {}, log: function () {return true;}});
      assert(grimm.log(), "Setting a log function works.");

      assert.equal("dev", grimm.env, "grimm.env should mirror the value set in the /conf/<env>.json file");
    });
  });

  grimm.start();
});