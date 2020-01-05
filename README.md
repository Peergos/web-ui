# peergos-ui-web
The Web interface for Peergos

# building

## install 

Requires [ant](http://ant.apache.org/) and Java 11.

NB: all other dependencies are checked into the repo, or into the submodule peergos repo.

### eg. on debian/ubuntu derivatives

```
sudo apt install openjdk-11-jdk ant
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
