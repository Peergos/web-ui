// The page behind a dialog, a viewer or a phone's navigation panel must not move under the
// finger or the wheel, so while any of them is open the page can't scroll. Taking its scrollbar
// away would widen the page by the width of that bar, so the room it took is held open.
// Overlays open over one another: the page stays held until the last of them lets go.
const holders = new Set();

module.exports = function lockPage(holder, locked) {
    const was = holders.size > 0;
    if (locked)
        holders.add(holder);
    else
        holders.delete(holder);
    if (was === holders.size > 0)
        return;
    if (was) {
        document.body.classList.remove("pg-dialog-open");
        document.body.style.paddingRight = "";
        return;
    }
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    if (gutter > 0)
        document.body.style.paddingRight = gutter + "px";
    document.body.classList.add("pg-dialog-open");
};
