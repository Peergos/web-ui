# peergos-ui-web
The Web interface for Peergos

## Screenshots

![Drive](/assets/images/tour/images.jpg)

![Calendar](/assets/images/tour/calendar.png)

![Social Feed](/assets/images/tour/social-feed.jpg)

![Chat](/assets/images/tour/chat.png)

![Email](/assets/images/tour/email.png)

We try to avoid JS based build tools and managers like webpack etc. to maintain greater control over the build process. This allows us to achieve cross-platform reproducible builds and future proof our build system (we should be able to build any commit any number of years into the future with only a JVM). The one exception to this is precompiling vue.js templates, which is done using vue-template-compiler run in a vendored copy of [GraalJS](https://www.graalvm.org/reference-manual/js/).

All our assets are vendored and served from a single domain, for improved privacy, security and reliability. 

Most of the complex logic around encryption etc. is implemented in Java in the peergos [submodule](https://github.com/peergos/peergos). This is all cross-compiled to JS using [GWT](http://www.gwtproject.org/) during the *compile_server* target. We plan to upgrade this to [J2CL](https://github.com/google/j2cl) when time and resources permit. Components are implemented as Vue 2 components in [src/components](https://github.com/peergos/web-ui/tree/master/src/components). 

## Setup

Requires [ant](http://ant.apache.org/) and Java 11.

NB: all other dependencies are checked into the repo, or into the submodule peergos repo.

### Debian/Ubuntu/Mint

```
sudo apt install openjdk-11-jdk ant
```
### MacOS
```shell
brew install ant # installs openjdk as a dependency
ant -version
Apache Ant(TM) version 1.10.8 compiled on May 10 2020
```
## Building
> ant dist

The output will be server/Peergos.jar

### Container Image (Docker)

Package Peergos into a container image with: 

```bash
docker build --file Containerfile --tag peergos:dev .
```

Then start Peergos inside the container with: 
```bash
docker run --volume $(PEERGOS_PATH):/opt/peergos/data peergos:dev daemon -log-to-console true
```


## Development

### Prod mode
1. Build and run an ephemeral local Peergos server on http://localhost:8000
> ant update_and_run
or rerun without rebuilding
> ant rerun
2. Build the UI (needs to be run after each change)
> ant ui

### Prod mode (native vite)
1. As above.
2. ant ui_native (repeat after each change)

### Dev mode
This disables CSP headers and vue template precompilation
1. Build and run an ephemeral local Peergos server on http://localhost:8000
> ant update_and_run_dev
or rerun it without rebuilding
> ant rerun_dev
2. Build the UI (needs to be run after each change)
ant ui_dev

### Dev mode (native)
1. As above
2. ant ui_dev_native (repeat after each change)

# This rebuilds the ui in dev mode whenever a file changes or is added in assets, vendor or src
ant watch_ui
```

##  Browser tests
[README](browser_tests/README.md) 


## Development
### Navigation between apps
Navigation between apps is driven by updating the URL fragment with an encrypted object, except for secret links which don't update the history

* drive.openFile(writable)
  -> getApp(file, path, writable)
  - isSecretLink ? drive.openInApp(args, app) OR openFileOrDir(app, path, args, writable)
* openFileOrDir(app, path, args, writable)
  -> updateHistory

* updateHistory(app, path, args, writable)
  - put these fields into an encrypted object in the url fragment

* onUrlChange
  - set view from props decrypted from URL
  - for non sidebar apps, call drive.openInApp(args, app)

* drive.openInApp(args, app)
  - set showX = true OR closeApps()
  
