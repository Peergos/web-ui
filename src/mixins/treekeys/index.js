// Keyboard for the folder trees, following the tree view pattern: one tab stop for the whole
// tree, arrows to move within it. Driven from the container, so the recursive rows stay simple.
const ROW = ".fp-row";

function rows(tree) {
    return Array.prototype.filter.call(tree.querySelectorAll(ROW), r => r.getClientRects().length > 0);
}

function focus(tree, row) {
    if (row == null)
        return;
    rows(tree).forEach(r => r.setAttribute("tabindex", "-1"));
    row.setAttribute("tabindex", "0");
    row.focus();
}

/** The control that opens a branch, or null on a leaf. */
function twisty(row) {
    const t = row.querySelector(".fp-row__twisty");
    return t != null && ! t.classList.contains("fp-row__twisty--leaf") ? t : null;
}

function isOpen(row) {
    const item = row.closest("[role=treeitem]");
    return item != null && item.getAttribute("aria-expanded") === "true";
}

/** The row of the branch this one sits in. */
function parentRow(row) {
    const nested = row.closest(".fp-children");
    return nested == null ? null : nested.parentElement.querySelector(ROW);
}

module.exports = {
    methods: {
        bindTreeKeys(selector) {
            const tree = this.$el.querySelector(selector);
            if (tree == null)
                return;
            this.treeKeysEl = tree;
            const first = rows(tree)[0];
            if (first != null)
                first.setAttribute("tabindex", "0");
            this.treeKeysHandler = e => {
                const all = rows(tree);
                const row = e.target.closest(ROW);
                const at = all.indexOf(row);
                if (at < 0)
                    return;
                let handled = true;
                if (e.key === "ArrowDown")
                    focus(tree, all[Math.min(at + 1, all.length - 1)]);
                else if (e.key === "ArrowUp")
                    focus(tree, all[Math.max(at - 1, 0)]);
                else if (e.key === "Home")
                    focus(tree, all[0]);
                else if (e.key === "End")
                    focus(tree, all[all.length - 1]);
                else if (e.key === "ArrowRight") {
                    const t = twisty(row);
                    if (t != null && ! isOpen(row))
                        t.click();
                    else
                        focus(tree, all[Math.min(at + 1, all.length - 1)]);
                } else if (e.key === "ArrowLeft") {
                    const t = twisty(row);
                    if (t != null && isOpen(row))
                        t.click();
                    else
                        focus(tree, parentRow(row));
                } else if (e.key.length === 1 && ! e.ctrlKey && ! e.metaKey && ! e.altKey && e.key !== " ") {
                // typing jumps to the next row that starts with what was typed, as a file
                // list does; a pause of a second starts a new word rather than extending one
                const now = Date.now();
                this.typed = now - (this.typedAt || 0) > 1000 ? e.key : this.typed + e.key;
                this.typedAt = now;
                const names = all.map(r => (r.textContent || "").trim().toLowerCase());
                const want = this.typed.toLowerCase();
                // from the row after this one, so repeating a letter walks the matches
                const from = this.typed.length === 1 ? at + 1 : at;
                for (let i = 0; i < all.length; i++) {
                    const j = (from + i) % all.length;
                    if (names[j].startsWith(want)) {
                        focus(tree, all[j]);
                        break;
                    }
                }
            } else if (e.key === "Enter" || e.key === " ") {
                    const box = row.querySelector(".fp-row__input");
                    if (box != null)
                        box.click();
                    else
                        row.click();
                } else
                    handled = false;
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            tree.addEventListener("keydown", this.treeKeysHandler);
        },
    },
    beforeDestroy() {
        if (this.treeKeysEl != null)
            this.treeKeysEl.removeEventListener("keydown", this.treeKeysHandler);
    },
};
