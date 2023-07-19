<template>
	<table class="drive-table">
		<thead>
			<tr>
                <th class="select"></th>
				<th class="file" @click="$emit('sortBy', 'name')">Name</th>  <!-- <span v-if="sortBy=='size'" :class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/> -->
				<th class="size" @click="$emit('sortBy', 'size')">Size</th>
				<th class="type" @click="$emit('sortBy', 'type')">Type</th>
				<th class="date" @click="$emit('sortBy', 'modified')">Modified</th>
				<th class="date" @click="$emit('sortBy', 'created')">Created</th>
				<th/>
            </tr>
		</thead>
		<tbody role="presentation">
			<tr v-for="file in files" tabindex="1" role="row" class="table__item">
                <td class="select">
                    <input type="checkbox" :value="file" v-model="selected" tabindex="0"/></td>
				<td class="file"
					:id="file.getFileProperties().name"
					@click="$emit('navigationteDrive', file)"
				>
                <!-- :class="{ shared: isShared(file) }"-->
					{{ file.getFileProperties().name }}
				</td>
				<td class="size">{{ convertBytesToHumanReadable(getFileSize(file.getFileProperties())) }}</td>
				<td class="type">{{ file.getFileProperties().getType() }}</td>
				<td class="date">{{ formatDateTime(file.getFileProperties().modified) }}</td>
				<td class="date">{{ formatDateTime(file.getFileProperties().created) }}</td>
				<td class="menu">
					<AppButton
						class="table__menu"
						icon="dot-menu"
						aria-label="menu"
						@click.stop.native="showMenu($event, file)"
					/>
				</td>
			</tr>
		</tbody>
	</table>
</template>

<script>
const AppButton = require("../AppButton.vue");
const mixins = require("../../mixins/downloader/index.js");

module.exports = {
	components: {
	    AppButton,
	},
	props: {
		files: {
			type: Array,
			default: ()=>[]
		},
        selectedFiles: {
            type: Array,
            default: ()=>[]
        },
	},
    mixins:[mixins],
    data: function () {
        return {
            selected: this.selectedFiles,
        }
    },
    watch: {
        selected(newSelected, oldSelected) {
            if(newSelected != this.selectedFiles){
            this.$emit('update:selectedFiles', newSelected)
            }
        },
        selectedFiles(newSelected, oldSelected){
            this.selected = newSelected
        }
    },
    methods: {
		showMenu(e, file){
			// https://stackoverflow.com/questions/53738919/emit-event-with-parameters-in-vue/53739018
			this.$store.commit('SET_DRIVE_MENU_TARGET', e.currentTarget)
			this.$emit('openMenu', file)
		},

		formatDateTime(dateTime) {
			let date = new Date(dateTime.toString() + "+00:00"); //adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
			let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
				+ ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
				+ ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
				+ ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
			return formatted;
		},
        convertBytesToHumanReadable:function(bytes) {
            if (bytes < 1024)
                return bytes + " Bytes";
            if (bytes < 1024 * 1024)
                return this.roundToDisplay(bytes / 1024) + " KiB";
            if (bytes < 1024 * 1024 * 1024)
                return this.roundToDisplay(bytes / 1024 / 1024) + " MiB";
            return this.roundToDisplay(bytes / 1024 / 1024 / 1024) + " GiB";
        },
        roundToDisplay:function(x) {
                return Math.round(x * 100) / 100;
        },
	},

}
</script>

<style>
.drive-table{

	width: calc(100% - 64px);
	margin: 32px;
	color: var(--color);
	font-size: var(--text);
	min-width: 1024px;
}
.drive-table tr{
	transition: background-color 0.3s ease;
	line-height: 32px;
	color: var(--color);
	border-top: 1px solid var(--border-color);
}

.drive-table thead tr{
	border: none;
	line-height: var(--app-margin);
}


.drive-table thead th,
.drive-table tbody .file{
	cursor: pointer;
}

.drive-table .size{
	text-align: right;
}

.drive-table .size,
.drive-table .type,
.drive-table .date,
.drive-table .select {
	padding: 0 16px;
}

.drive-table tbody tr:hover,
.drive-table tbody tr:focus{
	background-color: var(--bg-2);
}

.drive-table .menu{
	text-align: right;
}
.drive-table .table__menu{
	transition: opacity 0.3s ease;
	opacity: 0;
}
.drive-table tbody tr:hover .table__menu,
.drive-table tbody tr:focus .table__menu{
	opacity: 1;
}




</style>
