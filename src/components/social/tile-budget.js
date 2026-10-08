// How many tiles the feed keeps live at once. Every tile is a document, so a
// long feed scrolled end to end would otherwise hold one per shared item.
// A tile asks before mounting its frame and releases on unmount; when the
// budget is full the live tile furthest from the viewport is evicted, if it
// is further away than the one asking.
//
// A tile here is any object with distance(), grant() and evict().
module.exports = function TileBudget(max) {
    let live = new Set();
    let waiting = new Set();

    function furthest(tiles) {
        let found = null;
        tiles.forEach(t => {
            if (found == null || t.distance() > found.distance())
                found = t;
        });
        return found;
    }

    function nearest(tiles) {
        let found = null;
        tiles.forEach(t => {
            if (found == null || t.distance() < found.distance())
                found = t;
        });
        return found;
    }

    return {
        request(tile) {
            if (live.has(tile))
                return true;
            if (live.size >= max) {
                let victim = furthest(live);
                if (victim == null || victim.distance() <= tile.distance()) {
                    waiting.add(tile);
                    return false;
                }
                live.delete(victim);
                victim.evict();
                waiting.add(victim);
            }
            waiting.delete(tile);
            live.add(tile);
            return true;
        },
        release(tile) {
            waiting.delete(tile);
            if (! live.delete(tile))
                return;
            let next = nearest(waiting);
            if (next != null) {
                waiting.delete(next);
                live.add(next);
                next.grant();
            }
        },
        // Off screen: no longer a candidate for a free slot.
        withdraw(tile) {
            waiting.delete(tile);
        },
        get liveCount() {
            return live.size;
        },
    };
};
