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

## Coverage

Covered: sign in and reach the drive, upload a file, upload a group of files in one go, upload a
folder with a nested subfolder, render a pdf in the pdf app, two concurrent downloads, download a
folder as a zip, download a calendar event as .ics. Every assertion is on the bytes - hashed
against the source, unzipped and compared, or a rendered canvas with real dimensions - never on a
file or an app merely appearing.

The download tests are skipped on webkitgtk: WebKitWebDriver has no download directory
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



