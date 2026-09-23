/** The properties a drive listing can be sorted by, in the order they are offered.
 *
 *  Shared so the table's headings and the sort bar cannot drift apart: both name the same
 *  keys, and each key is what Drive.vue's setSortBy() expects.
 *  cls is the table's own column class, and means nothing to a caller that draws no table.
 */
module.exports = [
	{key: "name", cls: "file", label: "DRIVE.NAME"},
	{key: "size", cls: "size", label: "DRIVE.SIZE"},
	{key: "type", cls: "type", label: "DRIVE.TYPE"},
	{key: "modified", cls: "date", label: "DRIVE.MODIFIED"},
	{key: "created", cls: "date", label: "DRIVE.CREATED"},
];
