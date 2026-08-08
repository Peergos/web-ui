#!/bin/sh
# Launches the Electron window host. Chromium's own sandbox cannot set itself up
# inside a flatpak, so zypak stands in for it and hands the work to the portal;
# without this the window does not start at all.
exec zypak-wrapper /app/electron/electron /app/peergos-window "$@"
