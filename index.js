var async           = require('async');
var path            = require('path');
var filesystem      = require('fs');

var GrimmFramework = function() {
  var self = this;

  // Configuration Object
  var configuration = {};

  // Rood directory for the framework. Here we assume Grimm is a normally located module.
  var root_directory = path.resolve(__dirname, '../../');

  // The environment level (think dev, test, prod).
  var environment = 'dev';

  // A pointer to the web object, e.g. express()
  var web = null;

  // A pointer to express, e.g. require('express')
  var express = null;

  // A pointer to a server, e.g. http.createServer()
  var server = null;

  // A pointer to socket.io, e.g. require('socket.io').listen()
  var websockets = null;

  // A pointer to whiskers, e.g. require('whiskers')
  var template_engine = null;

  // A function to do our logging. Arguments include title, message, request
  var logger = null;

  /**
   * Sets some configuration settings used by some modules
   */
  self.configure = function(config) {
    configuration = config;

    return self;
  };

  /**
   * Loads configuration from a file
   */
  self.loadConfig = function(env, callback) {
    self.setEnv(env);

    self.log('config', 'Using config/' + environment + '.json');

    filesystem.readFile(path.resolve(__dirname + '/config/' + environment + '.json'), function(err, contents) {
      if (err) {
        callback(err);
        return;
      }
      self.configure(JSON.parse(contents));
      callback(null);
    });

    return self;
  };

  /**
   * Sets the environment. `dev` is assumed for a local dev machine, use w/e others you want
   */
  self.setEnv = function(env) {
    environment = env;
    return self;
  };

  /**
   * Sets the websocket engine. Right now we only support the `socket.io` module, but one day more
   */
  self.setSockets = function(engine) {
    websockets = engine;
    return self;
  };

  /**
   * Sets the web server. Right now we only support the `express` module, but one day more
   * This is starting to look ugly... Perhaps I should just load the modules from within grimm?
   */
  self.setWeb = function(engine, exp, srvr) {
    web = engine;
    express = exp;
    server = srvr;

    return self;
  };

  /**
   * Sets the template engine. Right now we only support the `whiskers` module, but one day more
   */
  self.setTemplate = function(engine) {
    template_engine = engine;
    return self;
  };

  /**
   * Sets the root directory, you probably want to just use __dirname from the loading script
   */
  self.setRoot = function(directory) {
    root_directory = directory;
    return self;
  };

  /**
   * Returns the root directory
   */
  self.getRoot = function() {
    return root_directory;
  };

  /**
   * Initializes some Grimm conventions
   */
  self.initialize = function() {
    // Provides /styles, /scripts, /images, etc. Mapped to the public/ dir
    web.use('/', express.static(root_directory + '/public'));
    self.log('public', '/* -> public/*');

    // Cache compiled HTML to make it faster. Unless we're in dev.
    if (environment !== 'dev') {
      web.use(function(req, res, next) {
        res.locals.cache = true;
        next();
      });
    }

    // Enable templating support for Express
    web.set('views', root_directory + '/views');
    web.engine('html', template_engine.__express);

    return self;
  };

  /**
   * Looks in our bundles directory, and attempts to load them all
   * Note that _errors is a special bundle and is loaded last (for now)
   */
  self.loadModules = function() {
    filesystem.readdir(root_directory + '/bundles', function(err, modules) {
      if (err) {
        self.log('module', 'Error reading modules directory (bundles)');
        self.log('module', err);
        process.exit(2);
      }

      self.log('modload', 'Loading Modules...');

      async.forEach(modules, attemptLoadController, function(err) {
        if (err) {
          self.log('module', err);
          process.exit(4);
          return;
        }
        loadController('_errors', function() {
          self.log('modload', 'All Modules Loaded.');
        });
      });
    });

    return self;
  }

  /**
   * Checks to see if the specified controller can be loaded, then passes
   * it off to loadController()
   * PRIVATE
   */
  function attemptLoadController(module_name, callback) {
    filesystem.stat(root_directory + '/bundles/' + module_name, function(err, stats) {
      // _errors is a special bundle that we don't want to load until the end
      if (module_name == '_errors') {
        callback();
        return;
      }

      if (err) {
        self.log('modload', 'Encountered an error whilst loading a module, ' + module_name);
        callback(err);
        return;
      }

      if (stats.isDirectory()) {
        loadController(module_name, callback);
      } else {
        // nothing to do...
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  }

  /**
   * Loads the specified controller, and assigns a public directory is applicable
   * PRIVATE
   */
  function loadController(module_name, callback) {
    self.log('modload', 'Loading: ' + module_name);
    require(root_directory + '/bundles/' + module_name)({
      "web": web,
      "config": configuration,
      "websockets": websockets,
      "handlebars": template_engine,
      "log": self.log
    });

    // Does this bundle contain a public/ directory?
    var public_dir = root_directory + '/bundles/' + module_name + '/public';
    filesystem.stat(public_dir, function(err, stats) {
      if (err) {
        return;
      };
      // bundles/:name/public* -> http://site/:name/*
      web.use('/' + module_name, express.static(public_dir));
      self.log('public', '/' + module_name + '/* -> bundles/' + module_name + '/public/*');
    });

    if (typeof callback === 'function') {
      callback();
    }
  }

  /**
   * Begins our web server
   */
  self.listen = function() {
    server.listen(configuration.web.port, configuration.web.host, null, function() {
      self.log('http', 'Listening on ' + (configuration.web.host || '*') + ':' + configuration.web.port);
      try {
        self.log('perms', 'Old User ID: ' + process.getuid() + ', Old Group ID: ' + process.getgid());
        process.setgid(configuration.permissions.group);
        process.setuid(configuration.permissions.user);
        self.log('perms', 'New User ID: ' + process.getuid() + ', New Group ID: ' + process.getgid());
      } catch (err) {
        self.log('perms', 'Cowardly refusing to keep the process alive as root.');
        process.exit(4);
      }
    });

      return self;
  };

  /**
   * Sets a function to be used for logging, instead of the built in one.
   */
  self.setLogger = function(logger) {
    self.logger = logger;

    return self;
  };

  /**
   * Logs a message into our specified format. Will need to beef this bad boy up one day.
   */
  self.log = function(level, message, details) {
    if (typeof self.logger === 'function') {
      self.logger(level, message, details);
      return;
    }
    var LEVEL_LEN = 8;
    var title = level.toString().substr(0,LEVEL_LEN).toUpperCase();
    while (title.length < LEVEL_LEN) {
      title = ' ' + title;
    }

    console.log('[' + title + '] ' + message);
  };
};

module.exports = new GrimmFramework();
