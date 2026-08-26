// What picking a folder means, shared by the drive picker and the local one: they differ in
// where the tree comes from, not in how a selection is built. Hosts own selectedFoldersList
// and multipleFolderSelection, and mix in i18n for the empty label.
module.exports = {
    computed: {
        hasSelection() {
            return this.selectedFoldersList.length > 0;
        },
        emptyLabel() {
            return this.translate(this.multipleFolderSelection ? "FOLDER.PICKER.NO.FOLDERS" : "FOLDER.PICKER.NO.FOLDER");
        },
    },
    methods: {
        selectFolder(path, add) {
            if (! add) {
                let at = this.selectedFoldersList.indexOf(path);
                if (at > -1)
                    this.selectedFoldersList.splice(at, 1);
                return;
            }
            // single selection: a new choice replaces the previous one
            if (! this.multipleFolderSelection)
                this.selectedFoldersList = [];
            this.selectedFoldersList.push(path);
        },

        clearSelection() {
            this.selectedFoldersList = [];
        },

        /** a folder that contains another selected one is already covered by it */
        withoutNested(folders) {
            return folders.filter((folder, i) =>
                ! folders.some((other, j) => j !== i && other.startsWith(folder + "/")));
        },
    },
};
