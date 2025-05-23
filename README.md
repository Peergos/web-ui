# peergos-ui-web
The Web interface for Peergos

## Screenshots

![Drive](/assets/images/tour/images.jpg)

![Calendar](/assets/images/tour/calendar.png)

![Social Feed](/assets/images/tour/social-feed.jpg)


We avoid JS based build tools and managers like npm, webpack etc. to maintain greater control over the build process. This allows us to achieve cross-platform reproducible builds and future proof our build system (we should be able to build any commit any number of years into the future with only a JVM). The one exception to this is precompiling vue.js templates, which is done using vue-template-compiler run in a vendored copy of [GraalJS](https://www.graalvm.org/reference-manual/js/).

All our assets are vendored and served from a single domain, for improved privacy, security and reliability. We use a very simple custom replacement for webpack written in Java which can handle vue components, called [JPack](https://github.com/ianopolous/jpack). 

Most of the complex logic around encryption etc. is implemented in Java in the peergos [submodule](https://github.com/peergos/peergos). This is all cross-compiled to JS using [GWT](http://www.gwtproject.org/) during the *compile_server* target. We plan to upgrade this to [J2CL](https://github.com/google/j2cl) when time and resources permit. Components are implemented as Vue 2 components in [src/components](https://github.com/peergos/web-ui/tree/master/src/components). 

## Setup

Requires [ant](http://ant.apache.org/) and Java 21 and at least 2 GB of RAM.

NB: all other dependencies are checked into the repo, or into the submodule peergos repo.

### Debian/Ubuntu/Mint

```
sudo apt install openjdk-21-jdk ant
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

Then start Peergos inside the container with the following if you are proxying localhost:8000 to the docker container: 
```bash
docker run --volume $(PEERGOS_PATH):/opt/peergos/data peergos:dev daemon -domain 0.0.0.0 -public-domain localhost:8000 -log-to-console true
```


## Development

### Server
```
# Build and run an ephemeral local Peergos server on http://localhost:8000
ant update_and_run

# or in dev mode - this disables CSP headers and vue template precompilation
ant update_and_run_dev
```

### Web Interface
```
# This builds the ui in prod mode
ant ui

# This builds the ui in dev mode, this only works with the server in dev mode, otherwise vue is blocked by our CSP. 
ant ui_dev

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
  
