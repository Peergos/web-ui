/** Uploads and downloads that can be cancelled from their progress toast.
 *
 *  Keyed by the toast's id, which vue-toastification hands the ProgressBar as its toast-id, so the
 *  bar knows to offer Cancel without every $toast.update having to carry a handler along.
 */
const transfers = {};

module.exports = {
    /** Registers a transfer under the id of the toast that shows it.
     *
     *  `isCancelled` is the supplier the java side polls between files and chunks. `kind` is
     *  'upload' or 'download', which decides what the toast says once it is cancelled.
     */
    start(toastId, kind) {
        const transfer = {
            id: toastId,
            kind: kind,
            cancelled: false,
            listeners: []
        };
        transfer.isCancelled = {get_0: () => transfer.cancelled};
        transfer.onCancel = function(listener) {
            if (transfer.cancelled)
                listener();
            else
                transfer.listeners.push(listener);
        };
        transfers[toastId] = transfer;
        return transfer;
    },

    /** For the uploads nobody can cancel from a toast. */
    never: {get_0: () => false},

    get(toastId) {
        return transfers[toastId];
    },

    cancel(toastId) {
        const transfer = transfers[toastId];
        if (transfer == null || transfer.cancelled)
            return null;
        transfer.cancelled = true;
        delete transfers[toastId];
        transfer.listeners.forEach(listener => {
            try {
                listener();
            } catch (e) {
                console.log(e);
            }
        });
        return transfer;
    },

    finish(transfer) {
        if (transfer != null && transfers[transfer.id] === transfer)
            delete transfers[transfer.id];
    },

    isCancelled(transfer) {
        return transfer != null && transfer.cancelled;
    }
};
