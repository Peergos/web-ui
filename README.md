# peergos-ui-web
The Web interface for Peergos

# building

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
## Running

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

# This builds the ui in dev mode
ant ui_dev

# This rebuilds the ui in dev mode whenever a file changes or is added in assets, vendor or src
ant watch_ui
```

##  Browser tests
[README](browser_tests/README.md) 
