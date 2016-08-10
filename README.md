# peergos-ui-web
The Web interface for Peergos

### building on linux

<pre>
sudo apt-get install nodejs npm
cd project_root
sudo npm rm --global gulp
sudo npm install --global gulp-cli
npm install

# This builds our dependencies
gulp build:vendor

# This builds our files
gulp #builds less, scripts etc. by default

# To update the local server deployment (assumes Peergos is in ../Peergos)
ant update_server

# To run the server (after updating)
ant run

# or in a single command
ant update_and_run

</pre>
