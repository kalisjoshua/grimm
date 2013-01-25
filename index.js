
var fs     = require('fs'),
    path   = require('path'),
    xtend  = require('xtend'),

    // these will be alias' on Grimm instance the map to "Express"-like methods
    REQUIRED_APP_METHODS = "delete get post put set use".split(" "),
    // these will be alias' on Grimm instance that map to the config in constructor
    REQUIRED_CONFIG_KEYS = "app engine env root server socketio templating".split(" "),
    // logging levels
    REQUIRED_LOGGING_LEVELS = "Debug Info Warn Error Fatal Audit".split(" "),

    htmlFiles = RegExp.prototype.test.bind(/html$/);


function buildFileObject (obj, dir, filter) {
  try {
    obj[dir.split("/").pop()] = fs.readdirSync(dir)
      .reduce(function (acc, item) {
        if (filter(item)) {
          acc[item.split(".").shift()] = [dir, item].join("/");
        }

        return acc;
      }, {});
    } catch (err) {}
}

/*= Grimm (HMVC)

  As in Grimm's Tales.
    
  Grimm builds on-top of express and adds Hierarchical MVC to a Node
  application. The Grimm object will be passed into the bundles to be
  used throughout the application so it is configurable.

  == (`grimm`) Instance Methods/Properties - passed to bundle controllers
  app                 instance of <express>
  engine              <express> function
  env                 env from /config/<env>.json
  root                path of the root folder of the application
  server              http.createServer(app)
  socketio            socketio library
  templating          instance of templating engine
  config              object from /config/<env>.json
  layouts             hash with filenames holding path to file
  partials            hash with filenames holding path to file
  delete              alias to <express>.delete
  get                 alias to <express>.get
  post                alias to <express>.post
  put                 alias to <express>.put
  set                 alias to <express>.set
  use                 alias to <express>.use
  log                 generic logging function
  logLevels           holds copy of levels from logger
  debug               alias to logger.debug
  info                alias to logger.info
  warn                alias to logger.warn
  error               alias to logger.error
  fatal               alias to logger.fatal
  audit               alias to logger.audit

  = Bundles

  Bundles will be logical groupings of an application. There will not be a clear
  definition of what dictates grouping; that will be based on the developer and
  the application.

  == (`bundle`) Instance Methods/Properties - passed to bundle controllers
  name                name of bundle folder
  views               hash with filenames holding path to file
  */

function Grimm (config) {
  // ensure all necessary properties are available before attempting to continue
  Grimm.fn.validateConfig(config);

  // resolve path to make it reliable for later use
  config.root = path.resolve(config.root);

  // add properties to instance after validating they are there first
  REQUIRED_CONFIG_KEYS
    .forEach(function (prop) {
      this[prop] = config[prop];
    }.bind(this)); // bind the function to the instance not the array item

  this.sockets = config.socketio.listen(config.server);

  // all of the other settings aren't necessary to the app once running,
  // and are still available on the config object if necessary in the future...?
  this.env = this.env.env;

  this.config = config.env;
  // this.json = this.root + "/json";
  // this.models = this.root + "/models";

  buildFileObject(this, this.root + "/views/layouts", htmlFiles);
  buildFileObject(this, this.root + "/views/partials", htmlFiles);

  // alias application methods on the instance to make it nicer for developers
  REQUIRED_APP_METHODS
    .forEach(function (method) {
      this[method] = function () {
        config.app[method].apply(config.app, [].slice.call(arguments, 0));
      };
    }.bind(this));

  // if no logger is configured then augment the object with the level methods
  if (!config.logger) {
    REQUIRED_LOGGING_LEVELS
      .forEach(function (level) {
        this[level] = this[level.toLowerCase()] = Grimm.fn.log.bind(this, level);
      }.bind(this));
  } else {
    // A log function is optional since Grimm will provide a default.
    Grimm.fn.setLogger.call(this, config.logger);
  }
}

Grimm.fn = 
Grimm.prototype = {
  handler: function (data) {
    var grimm = this;

    return function (req, res) {
      res.render(grimm.layouts.front, xtend({}, {
        partials: {
          footer: grimm.partials.footer
        },
        title: "Default Page Title"
      // FIXME: this nastiness needs to be done right now because the partials
      //        get compiled to functions - instead of remaining paths to files
      }, JSON.parse(JSON.stringify(data))));
    };
  },

  // exposed for people smarter than me who want to do tricky stuff with startup
  // TODO: provide a way to get the config of the instance to enable above
  initialize: function () {
    // Cache compiled HTML to make it faster. Unless we're in dev.
    if (this.env !== "dev") {
      this.app.use(function(req, res, next) {
        res.locals.cache = true;
        next();
      });
    }

    // Enable templating support for Express
    this.app.set('views', this.root + '/views');
    this.app.engine('html', this.templating.__express);

    // Accept POST data
    this.app.use(this.engine.bodyParser());

    return this;
  },

  // exposed for people smarter than me who want to do tricky stuff with startup
  // TODO: provide a way to get the config of the instance to enable above
  listen: function (config) {
    this.server.listen(config.web.port, config.web.host, null, function() {
      this.info('(http) Listening on ' + (config.web.host || '*') + ':' + config.web.port);

      try {
        this.info('(perms) Old User ID: ' + process.getuid() + ', Old Group ID: ' + process.getgid());

        process.setgid(config.permissions.group);
        process.setuid(config.permissions.user);

        this.info('(perms) New User ID: ' + process.getuid() + ', New Group ID: ' + process.getgid());
      } catch (err) {
        this.info('(perms) Cowardly refusing to keep the process alive as root.');
        process.exit(4);
      }
    }.bind(this));

    return this;
  },

  // TODO: (maybe) what happens with deeper bundles? will they ever even exist?
  loadBundles: function () {
    var grimm = this;

    function load (bundle) {
      var loc = grimm.root + "/bundles/" + bundle + "/index.js";

      // controller
      fs.exists(loc, function (exists) {
        var locals = {name: bundle};

        if (exists) {
          grimm.info("Loading bundle: " + bundle);
          // FIXME: what about controller files that don't export a function?
          // TODO: load locals: content? (CMS), json?, models?, views
          buildFileObject(locals, loc.split("/").slice(0, -1).join("/") + "/views", htmlFiles);

          // load the Node module and then execute the function
          require(loc)(grimm, locals);
        }
      });
      
      // public directory
      Grimm.fn.registerPublic.call(grimm, "./bundles/" + bundle);
    }

    fs.readdir(grimm.root + "/bundles", function (err, bundles) {
      if (err) {
        grimm.error("No bundles found. Do you really need Grimm?");
      } else {
        bundles
          .filter(function (name) {return name !== "_errors";}) // skip errors
          .forEach(load);

        load("_errors"); // errors need to be loaded last so they evaluate last
      }
    });

    return this;
  },

  // static log function; logs to console.log
  /*
    This function should have no reference to any external logger function/object
    passed into the constructor; that way this function cna be used as a fallback
    function for the external library and not create a cyclical reference.
    */
  log: function (level, message, details) {
    if (!!level && ~(this.logLevels || []).indexOf(level) && !!message) {
      this.debug("no level or message passed to Grimm.log()."); // very meta

      return this;
    }

    var LEVEL_LEN = 8;
    var title = level.toString().substr(0, LEVEL_LEN).toUpperCase(),
        space = Array(LEVEL_LEN - title.length).join(" ");

    console.log('[' + space + title + '] ' + message, details || "");

    return this;
  },

  // safely set the log function; with fallback to static log function
  setLogger: function (logger) {
    if (!logger) {
      throw new Error("Logger not provided to setLogger().");
    }

    ((logger.getLevels && logger.getLevels()) || REQUIRED_LOGGING_LEVELS)
      .forEach(function (level) {
        if (logger[level]) {
          this[level] = this[level.toLowerCase()] = logger[level].bind(logger);
        }
      }.bind(this));

    if (logger.log) {
      this.log = logger.log.bind(logger);
    }

    return this;
  },

  // used for app/public and /bundles/*/public (hopefully)
  registerPublic: function (loc) {
    loc = path.resolve(this.root + "/" + (loc || "").replace(/\/$/, "") + "/public");

    fs.stat(loc, function (err, stat) {
      if (err) {
        this.info("No public directory found: " + loc);
      } else if (stat.isDirectory()) {
        this.info("Registered public directory: " + loc);

        // "static" is a reserved word so we use index notation here
        this.use(this.engine["static"](loc));
      }
    }.bind(this));
    
    return this;
  },

  // call everything in order as a shortcut for application startup
  start: function (config) {

    Grimm.fn.registerPublic.call(this);

    Grimm.fn.initialize.call(this);

    Grimm.fn.loadBundles.call(this);

    // listen will need config since it will retain reference to /config/<env>.json
    Grimm.fn.listen.call(this, this.config);

    return this;
  },

  toString: function () {
    return "[object Grimm Framework]";
  },

  ts: function () {
    return this.toString();
  },

  validateConfig: function (config) {
    if (!config) {
      throw new Error("Required configuration object not provided to Grimm constructor.");
    }

    REQUIRED_CONFIG_KEYS
      .forEach(function (key) {
        if (!config[key]) {
          throw new Error("Required configuration property [" + key + "] not provided to Grimm constructor.");
        }
      });

    // config.app required methods/properties
    REQUIRED_APP_METHODS
      .forEach(function (method) {
        if (!config.app[method]) {
          throw new Error("Required method/property not available on config.app: " + method);
        }
      });

    // if execution gets here all is well
    return true;
  },

  valueOf: function () {
    return this.toString();
  }
};

module.exports = Grimm;
