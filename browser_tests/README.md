# Peergos web-ui browser tests

## Java tests (current)

Direct drivers, no third party libraries and no downloaded browser drivers. Run one engine:

```
cd browser_tests
java -cp ../server/Peergos.jar Suite.java firefox     # or chromium, or webkit
```

Each run starts its own Peergos server on a free port with its own PEERGOS_PATH, uploads its own
fixtures, and stops the server afterwards. Nothing touches another Peergos on the machine.

- `HEADLESS=0` to watch it. WebKitGTK has no headless mode, so it needs either a real display or
  xvfb; the launcher uses `xvfb-run` when it is installed.
- `FIREFOX`, `CHROMIUM`, `CHROMEDRIVER`, `WEBKITWEBDRIVER` override binary locations.
- `-Dfixture.size=` and `-Dlatency.ms=` tune the download test.

Drivers: Firefox needs none, it is driven over marionette which is built in. Chromium needs
`chromedriver` and WebKitGTK needs `WebKitWebDriver` (`apt install webkit2gtk-driver`), both from
the distro so they stay version matched to their browser.

Single file source programs, so there is no build step - `java` compiles them on the fly and
`../server/Peergos.jar` supplies the json parser.

## Python tests (unmaintained)

The selenium suite below has not run in CI since 2021 and no longer runs at all: it pins
selenium 3.14 and Chrome 84, and downloads chromedriver from an endpoint that now 404s. Kept for
reference while its cases are ported.


Runs selenium-based tests against a local Peergos web-server.

### requirements
* Python 3.6+
* pip3
* Chrome 84 (or Chromium) web browser
NB: *it has to be chrome84 for the web-driver to work*
> sudo apt-get install python-setuptools
#####  chromedriver
taken from https://sites.google.com/a/chromium.org/chromedriver/downloads

### install dependencies and python  v-env
>  . setup_browser_tests.sh

### start server and run tests
##### with  visible browser
> ./run_browser_tests.sh 0 || true 
##### headlessly 
> ./run_browser_tests.sh || true 


### test cases (X = done)
(firefox, chromium) * (desktop, mobile) for all

#### account stuff
* sign up - X
* sign up password warning for "123456"
* sign up password warning for < 12 chars
* sign in - X
* change password
* sign out - X

#### single user stuff
* upload file and read back (< 5mb, > 5mb)
* create dir - X
* rename file
* delete file
* rename dir
* delete dir
* move (drag and drop) file into subdir
* cut file, paste into subdir
* cut and paste dir into another dir
* upload file into dir and read back
* upload image and check for thumbnail
* upload movie and check for thumbnail
* public link to file
* public link to dir
* public link to image and ?open=true

#### single user media
* stream download file > 10mb (?streaming=true on url)
* play movie
* play audio
* open image inline
* open text file inline
* open binary file inline > 1mb

#### multi user
* add friend
* add friend and share file and read back from friend
* add friend, share dir, and read dir listing from friend
* check context."shared with" on a file shared with a friend
* unshare file and check friend can't see it anymore
* unfriend and check they can't see a file you shared with them
* unfollow and check you can't see a file they've shared with you
* a friend sees a newly shared file without logging out and in



