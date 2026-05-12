#!/bin/sh

GTK_USE_PORTAL=0 chromium --no-default-browser-check --disable-sync --disable-default-apps --no-first-run --window-size=1280,900 --log-level=3 --disable-features=UsePortalFileChooser --app=http://localhost:$1 2>&1 | grep -v "xapp-gtk3-module"
