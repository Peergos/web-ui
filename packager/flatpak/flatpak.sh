#!/bin/sh

chromium --no-default-browser-check --disable-sync --disable-default-apps --no-first-run --window-size=1280,900 --log-level=3 --app=http://localhost:$1
