# peergos-ui-web
The Web interface for Peergos

### building on any platform

<pre>
install Java 8

#### Server
# To update the local server deployment (assumes Peergos is in ../Peergos)
ant update_server

# To run the server (after updating)
ant run

# or in a single command
ant update_and_run

### Web Interface
# This builds our dependencies
ant vendor

# This builds our files
ant ui

# This continuously builds our files whenever a file changes or is added
ant watch_ui



</pre>
