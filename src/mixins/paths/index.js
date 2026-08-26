// Splitting and joining paths for display. The server canonicalises relative paths to "/"
// even on windows, but a local root keeps the platform's own separator.
module.exports = {
    methods: {
        lastSeparator(path) {
            let p = ("" + path).replace(/[\\/]+$/, '');
            return Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
        },

        /** everything above the leaf, which is the part that gets ellipsised when it does not fit */
        pathHead(path) {
            let p = ("" + path).replace(/[\\/]+$/, '');
            let cut = this.lastSeparator(p);
            return cut <= 0 ? p : p.substring(0, cut);
        },

        /** the leaf, kept whole */
        pathTail(path) {
            let p = ("" + path).replace(/[\\/]+$/, '');
            let cut = this.lastSeparator(p);
            return cut <= 0 ? '' : p.substring(cut);
        },

        /** the leaf on its own, for a row that shows just the folder's name */
        pathLeaf(path) {
            if (path == null)
                return "";
            let p = ("" + path).replace(/[\\/]+$/, '');
            return p.substring(this.lastSeparator(p) + 1);
        },

        joinPath(root, rel) {
            let sep = root.includes("\\") && ! root.includes("/") ? "\\" : "/";
            return root.replace(/[\\/]+$/, '') + sep + (sep === "/" ? rel : rel.replace(/\//g, sep));
        }
    }
}
