/** The icon a file's type is drawn with, shared by every view that lists files. */
module.exports = {
    methods: {
        fileIcon(type) {
            if (type == 'dir') return 'folder--72';
            if (type == 'image') return 'file-image--72';
            if (type == 'text') return 'file-text--72';
            if (type == 'audio') return 'file-audio--72';
            if (type == 'video') return 'file-video--72';
            if (type == 'pdf') return 'file-pdf--72';
            if (type == 'zip') return 'file-zip--72';
            if (type == 'calendar') return 'calendar--72';
            if (type == 'contact file') return 'file-card--72';
            if (type == 'powerpoint presentation' || type == 'presentation') return 'file-powerpoint--72';
            if (type == 'word document' || type == 'text document') return 'file-word--72';
            if (type == 'excel spreadsheet' || type == 'spreadsheet') return 'file-excel--72';
            return 'file-generic--72';
        }
    }
}
