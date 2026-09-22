/** The aria-sort a column heading carries. Taken as arguments rather than read off the
 *  component, because a view can hold more than one sorted table. */
module.exports = {
    methods: {
        ariaSortOf(sortedBy, column, ascending) {
            if (sortedBy != column)
                return "none";
            return ascending ? "ascending" : "descending";
        }
    }
}
