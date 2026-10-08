// How many tiles the feed keeps live at once. Every tile is a document, so a
// long feed scrolled end to end would otherwise hold one per shared item.
// A tile asks before mounting its frame and releases on unmount; when the
// budget is full the live tile furthest from the viewport is evicted, if it
// is further away than the one asking.
//
// A tile with a key belongs to a custom app, and none with a blocked key is
// live: while the app itself is open in the feed its tiles step aside, since the
// app's service worker refuses requests it cannot place while a tile is running.
//
// A tile here is any object with key, distance(), grant() and evict().
module.exports = function TileBudget(max) {
    let live = new Set();
    let waiting = new Set();
    let blocked = new Set();

    function grantable(tile) {
        return tile.key == null || ! blocked.has(tile.key);
    }

    function furthest(tiles) {
        let found = null;
        tiles.forEach(t => {
            if (found == null || t.distance() > found.distance())
                found = t;
        });
        return found;
    }

    function evict(tile) {
        live.delete(tile);
        tile.evict();
        waiting.add(tile);
    }

    // Free slots go to the nearest waiting tiles that may have one.
    function fill() {
        while (live.size < max) {
            let next = null;
            waiting.forEach(t => {
                if (grantable(t) && (next == null || t.distance() < next.distance()))
                    next = t;
            });
            if (next == null)
                return;
            waiting.delete(next);
            live.add(next);
            next.grant();
        }
    }

    return {
        request(tile) {
            if (live.has(tile))
                return true;
            if (! grantable(tile)) {
                waiting.add(tile);
                return false;
            }
            if (live.size >= max) {
                let victim = furthest(live);
                if (victim == null || victim.distance() <= tile.distance()) {
                    waiting.add(tile);
                    return false;
                }
                evict(victim);
            }
            waiting.delete(tile);
            live.add(tile);
            return true;
        },
        release(tile) {
            waiting.delete(tile);
            if (live.delete(tile))
                fill();
        },
        // Off screen: no longer a candidate for a free slot.
        withdraw(tile) {
            waiting.delete(tile);
        },
        block(key) {
            blocked.add(key);
            Array.from(live).filter(t => t.key === key).forEach(evict);
            fill();
        },
        unblock(key) {
            blocked.delete(key);
            fill();
        },
        get liveCount() {
            return live.size;
        },
    };
};
