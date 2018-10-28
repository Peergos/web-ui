# peergos-ui-web
The Web interface for Peergos

![Build Status](https://ci.boddy.im/buildStatus/icon?job=peergos-web-ui)

# building

## install 

Requires [ant](http://ant.apache.org/) along with Java 8 including JavaFX. 

NB: all other dependencies are checked into the repo.

### eg. on debian/ubuntu derivatives

```
sudo apt install openjdk-8-jdk openjfx ant
```

### project setup

To get started following script will:
* checkout the project 
* build the server
* build the web-ui
* start a local Peergos server on http://localhost:8000 for web-ui development in which all writes are local to memory

```
git checkout https://github.com/peergos/web-ui
cd web-ui
ant update_and_run
```

### Server

```
# To update the local server deployment (assumes Peergos is in ../Peergos)
ant update_server

# To run the server (after updating)
ant run

# or in a single command
ant update_and_run
```

### Web Interface
```
# This builds our dependencies
ant vendor

# This builds our files
ant ui

# This continuously builds our files whenever a file changes or is added
ant watch_ui
```

##  Browser-based tests
[README](browser_tests/README.md) 
