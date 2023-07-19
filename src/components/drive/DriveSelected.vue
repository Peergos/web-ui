<template>
  <div class="drive-selected">
    <AppButton v-show="selectedFiles.length" @click.native="showMenu">
      with {{ selectedFiles.length }} selected:
    </AppButton>

    <transition name="drop">
      <DriveMenu ref="selectedMenu" v-if="viewSelectedMenu" @closeMenu="closeMenu()">
        <li id="zip" @keyup.enter="zip" @click="zip">Zip</li>
        <li id="copy" @keyup.enter="copy" @click="copy">Copy</li>
        <li id="cut" @keyup.enter="cut" @click="cut">Cut</li>
        <li id="delete" @keyup.enter="deleteSelected" @click="deleteSelected">Delete</li>
        <li id="download" @keyup.enter="download" @click="download">Download</li>
      </DriveMenu>
    </transition>

    <!-- 
    <select v-model="operation" v-show="selectedFiles.length">
      <option disabled value="">With {{ selectedFiles.length }} selected:</option>
      <option value="zip">Zip</option>
      <option value="copy">Copy</option>
      <option value="cut">Cut</option>
      <option value="delete">Delete</option>
      <option value="download">Download</option>
    </select> 
    -->
  </div>
</template>
<script>
const AppButton = require("../AppButton.vue");
const DriveMenu = require("./DriveMenu.vue");

module.exports = {
  components: {
    AppButton,
    DriveMenu,
  },
  props: {
    selectedFiles: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      viewSelectedMenu: false,
      //   operation: "",
    };
  },
  //   watch: {
  //     operation(newOp, oldOp) {
  //       if (newOp != "") {
  //         console.log(newOp + " selected");
  //         this.$emit(newOp);
  //         this.operation = "";
  //       }
  //     },
  //   },
  methods: {
    showMenu(e) {
      // https://stackoverflow.com/questions/53738919/emit-event-with-parameters-in-vue/53739018
      this.$store.commit("SET_DRIVE_MENU_TARGET", e.currentTarget);
      this.viewSelectedMenu = true;
      Vue.nextTick(() => {
        this.$refs.selectedMenu.$el.focus();
      });
    },
    closeMenu() {
      this.viewSelectedMenu = false;
    },
    zip() {
      this.closeMenu();
      this.$emit("zip");
    },
    copy() {
      this.closeMenu();
      this.$emit("copy");
    },
    cut() {
      this.closeMenu();
      this.$emit("cut");
    },
    deleteSelected() {
      this.closeMenu();
      this.$emit("delete");
    },
    download() {
      this.closeMenu();
      this.$emit("download");
    },
  },
};
</script>
<style>
.drive-selected {
  margin: 0 32px;
  padding: 0 16px;
}

.drive-selected .count {
  margin-right: 32px;
  cursor: pointer;
}
</style>
