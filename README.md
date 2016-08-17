# peergos-ui-web
The Web interface for Peergos

### building on linux

<pre>
install Java 8

# This builds our dependencies
ant vendor

# This builds our files
ant ui

# To update the local server deployment (assumes Peergos is in ../Peergos)
ant update_server

# To run the server (after updating)
ant run

# or in a single command
ant update_and_run

</pre>
