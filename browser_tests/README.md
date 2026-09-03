# Peergos web-ui browser tests

## Java tests (current)

Direct drivers, no third party libraries and no downloaded browser drivers. Run one engine:

```
cd browser_tests
java -cp ../server/Peergos.jar Suite.java firefox     # or chromium, webkit, safari
```

CI runs the matrix: firefox and chromium on linux, windows and macos; webkitgtk on linux;
safari on macos.

Each run starts its own Peergos server on a free port with its own PEERGOS_PATH, uploads its own
fixtures, and stops the server afterwards. Nothing touches another Peergos on the machine.

- `HEADLESS=0` to watch it. Neither WebKitGTK nor safari has a headless mode: webkitgtk needs a
  real display or xvfb, which the launcher uses when it is installed, and safari always needs a
  ui session.
- `FIREFOX`, `CHROMIUM`, `CHROMEDRIVER`, `WEBKITWEBDRIVER` override binary locations.
- `-Dfixture.size=` and `-Dlatency.ms=` tune the download test.

Drivers: Firefox needs none, it is driven over marionette which is built in. Chromium needs
`chromedriver` and WebKitGTK needs `WebKitWebDriver` (`apt install webkit2gtk-driver`), both from
the distro so they stay version matched to their browser.

Single file source programs, so there is no build step - `java` compiles them on the fly and
`../server/Peergos.jar` supplies the json parser.

## Coverage

Covered: sign in and reach the drive, upload a file, upload a group of files in one go, upload a
folder with a nested subfolder, render a pdf in the pdf app, follow markdown links to a sibling
and into a subdirectory, render html with links and images from both its own directory and a
subdirectory, two concurrent downloads, download a folder as a zip, download a calendar event
as .ics. Every assertion is on the bytes - hashed
against the source, unzipped and compared, or a rendered canvas with real dimensions - never on a
file or an app merely appearing.

The html viewer test signs up its own user. `/peergos/` is a magic prefix to the sandbox service
worker, marking an absolute drive path of the form `/peergos/<username>/<rest>` which it redirects
to `/<username>/<rest>`. The admin account is itself called `peergos`, so viewing html from it
gets redirected as though the first directory name were the username, and renders nothing.

The download tests are skipped on webkitgtk and safari: neither driver has a download directory
capability, so there is nowhere to look for the file. Only chromedriver can drive the folder
picker; marionette refuses a directory outright and WebKitWebDriver takes it as a single file, so
elsewhere the folder upload hands the app the same flat webkitRelativePath list the browser would
have built.

Everything below is still to do, on each of firefox, chromium and webkitgtk.

#### account stuff
* sign up
* sign up password warning for "123456"
* sign up password warning for < 12 chars
* sign in
* change password
* sign out
#### single user stuff
* upload file and read back (< 5mb, > 5mb)
* create dir
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



