<template>
	<table class="drive-table">
		<thead>
			<tr>
                <th class="select"></th>
				<th class="file" @click="$emit('sortBy', 'name')">{{ translate("DRIVE.NAME") }}</th>  <!-- <span v-if="sortBy=='size'" :class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/> -->
				<th class="size" @click="$emit('sortBy', 'size')">{{ translate("DRIVE.SIZE") }}</th>
				<th class="type" @click="$emit('sortBy', 'type')">{{ translate("DRIVE.TYPE") }}</th>
				<th class="date" @click="$emit('sortBy', 'modified')">{{ translate("DRIVE.MODIFIED") }}</th>
				<th class="date" @click="$emit('sortBy', 'created')">{{ translate("DRIVE.CREATED") }}</th>
				<th/>
            </tr>
		</thead>
		<tbody role="presentation">
			<tr v-for="file in files" tabindex="1" role="row" class="table__item">
                <td class="select">
                    <label class="checkbox__group">
                        <input
                        type="checkbox"
                        :name="file.getFileProperties().name"
                        v-model="selected"
                        :value="file"
                        tabindex="0"
                        @click.shift="clickShiftHandler"
                        />
                        <span class="checkmark"></span>
                    </label>            
                </td>
                <td class="">
                    <img
				class="tablethumb"
				v-if="getThumbnailURL(file)"
				:src="getThumbnailURL(file)"
		    />
                    <AppIcon v-else class="card__icon" :icon="cardIcon(file)" />
                </td>
				<td class="file"
					:id="file.getFileProperties().name"
					@click="$emit('navigateDrive', file)"
				>
                <!-- :class="{ shared: isShared(file) }"-->
					{{ file.getFileProperties().name }}
				</td>
				<td class="size" v-if="!file.isWrapper && !file.isDirectory()">{{ convertBytesToHumanReadable(getFileSize(file.getFileProperties())) }}</td>
				<td class="size" v-if="!file.isWrapper && file.isDirectory()">{{ file.directChildrenCount }} items</td>
				<td class="size" v-if="file.isWrapper">Loading...</td>
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
const AppIcon = require("../AppIcon.vue");
const mixins = require("../../mixins/downloader/index.js");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
	    AppIcon
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
    mixins:[mixins, i18n],
    data: function () {
        return {
            selected: this.selectedFiles,
            isShiftModifierOn: false,
        }
    },
    watch: {
        selected(newSelected, oldSelected) {
              if (this.isShiftModifierOn && newSelected.length == oldSelected.length +1) {
                  if(newSelected != this.selectedFiles){
                      let difference = newSelected.filter(x => !oldSelected.includes(x))[0];
                      let newIndex = this.files.indexOf(difference);
                      var largestIndex = -1;
                      for(var i=0; i < newSelected.length; i++) {
                          let index = this.files.indexOf(newSelected[i]);
                          if (index < newIndex && index > largestIndex) {
                              largestIndex = index;
                          }
                      }
                      let selectedWithShift = newSelected.concat(this.files.slice(largestIndex +1, newIndex));
                      this.$emit('update:selectedFiles', selectedWithShift);
                  }
              } else {
                  if(newSelected != this.selectedFiles){
                      this.$emit('update:selectedFiles', newSelected)
                  }
              }
        },
        selectedFiles(newSelected, oldSelected){
            this.selected = newSelected;
            this.isShiftModifierOn = false;
        }
    },
    methods: {
        clickShiftHandler() {
            this.isShiftModifierOn = true;
        },

		getThumbnailURL(file) {
			// cache thumbnail to avoid recalculating it
			if (file.thumbnail != null)
				return file.thumbnail;
			var thumb = file.getBase64Thumbnail();
			file.thumbnail = thumb;
			return thumb;
		},

                cardIcon(file){
                        let type = file.getFileProperties().getType()
			if (type == 'dir') 	return 'folder--72';
			if (type == 'image') 	return 'file-image--72';
			if (type == 'text') 	return 'file-text--72';
			if (type == 'audio') 	return 'file-audio--72';
			if (type == 'video') 	return 'file-video--72';
			if (type == 'pdf') 	return 'file-pdf--72';
			if (type == 'zip') 	return 'file-zip--72';
			if (type == 'calendar') 	return 'calendar--72';
			if (type == 'contact file') 	return 'file-card--72';
			if (type == 'powerpoint presentation' || type == 'presentation') 	return 'file-powerpoint--72';
			if (type == 'word document' || type == 'text document') 	return 'file-word--72';
		        if (type == 'excel spreadsheet' || type == 'spreadsheet') 	return 'file-excel--72';
                        return 'file-generic--72';
		},

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
            if (bytes < 1000)
                return bytes + " Bytes";
            if (bytes < 1000 * 1000)
                return this.roundToDisplay(bytes / 1000) + " KB";
            if (bytes < 1000 * 1000 * 1000)
                return this.roundToDisplay(bytes / 1000 / 1000) + " MB";
            return this.roundToDisplay(bytes / 1000 / 1000 / 1000) + " GB";
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
        position: sticky;
        top: 0;
        background-color: var(--bg);
        z-index: 10;
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

.tablethumb {

	width:50px;
	height:50px;
	object-fit: cover;
	object-position: center center;
	transform: scale(1);
	transition: transform 0.2s;
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
