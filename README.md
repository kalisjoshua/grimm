# Grimm Framework

This is a Node.js HMVC framework. Right now it's just a placeholder. The framework is mostly
complete, and should be uploaded in a week or two.

The H part means that there are many different MVC 'bundles' within the application. Each one
contains its own controller, models, views, and even public directories.

# Filesystem

Here is an example of the filesystem structure for a Grimm based application. Each sub MVC bundle
is located in the bundles folder. The index.js file is the controller code for that sub
MVC. As you can probably guess by the filename, it is loaded as a typical Node Module.

    /Users/thunter/app/
    |~config/
    | |-dev.json
    | |-prod.json
    |~bundles/
    | |~_errors/
    | | |~views/
    | | | |-404.html
    | | | `-500.html
    | | `-index.js
    | |~prototypes/
    | | |~public/
    | | | |~images/
    | | | |~scripts/
    | | | | `-main.js*
    | | | `~styles/
    | | |   `-main.css*
    | | |~views/
    | | | `-index.html*
    | | `-index.js
    | `+root/
    |~data/
    | |-global.json
    |+models/
    |~node_modules/
    | |+async/
    | |+express/
    | |+grimm/
    | |+hbs/
    | `+socket.io/
    |~public/
    | |+images/
    | |+scripts/
    | |+styles/
    | |-favicon.ico
    | `-robots.txt
    |~views/
    | |~layouts/
    | | `-main.html
    | `-index.html
    `-server.js*

