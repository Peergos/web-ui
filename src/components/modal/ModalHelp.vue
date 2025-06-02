<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;">
        <div class="modal-header" style="padding:0">
            <center><h2>{{ translate("HELP.TITLE") }}</h2></center>
            <span @click="close" tabindex="0" v-on:keyup.enter="close" style="position:absolute;top:-10px;right:40px;z-index:999;color:black;font-size:3em;font-weight:bold;cursor:pointer;font-family:'Cambria Math'">&times;</span>
        </div>
        <div class="modal-body">
            <h2>{{ translate("HELP.HOW") }}</h2>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.UPGRADE") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.UPGRADE.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.SPACE") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.SPACE.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.FOLLOW") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.FOLLOW.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.FRIENDS") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.FRIENDS.TEXT1") }}</p>
              <p>{{ translate("HELP.FRIENDS.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.PROFILE") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.PROFILE.TEXT1") }}</p>
              <p>{{ translate("HELP.PROFILE.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.SHARE") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.SHARE.TEXT1") }}</p>
              <p>{{ translate("HELP.SHARE.TEXT2") }}</p>
              <p>{{ translate("HELP.SHARE.TEXT3") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.SHARED.FILES") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.SHARED.FILES.TEXT1") }}</p>
              <p>{{ translate("HELP.SHARED.FILES.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.LINK") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.LINK.TEXT1") }}</p>
              <p>{{ translate("HELP.LINK.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.CAL") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.CAL.TEXT1") }}</p>
              <p>{{ translate("HELP.CAL.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.SHARE.CAL") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.SHARE.CAL.TEXT1") }}</p>
              <p>{{ translate("HELP.SHARE.CAL.TEXT2") }}<p>
              <p>{{ translate("HELP.SHARE.CAL.TEXT3") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.SHARE.EVENT") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.SHARE.EVENT.TEXT1") }}</p>
              <p>{{ translate("HELP.SHARE.EVENT.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.IMPORT.EVENT") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.IMPORT.EVENT.TEXT1") }}</p>
              <p>{{ translate("HELP.IMPORT.EVENT.TEXT2") }}</p>
              <p>{{ translate("HELP.IMPORT.EVENT.TEXT3") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.WWW") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.WWW.TEXT1") }}</p>
              <p>{{ translate("HELP.WWW.TEXT2") }}</p>
              <p>{{ translate("HELP.WWW.TEXT3") }}</p>
              <p>{{ translate("HELP.WWW.TEXT4") }}</p>
              <p>{{ translate("HELP.WWW.TEXT5") }}: <a class="help-link" href="https://peergos.org/posts/p2p-web-hosting" target="_blank" rel="noopener noreferrer">https://peergos.org/posts/p2p-web-hosting</a></p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.CLEANUP") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.CLEANUP.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.THUMB") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.THUMB.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.FEEDBACK") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.FEEDBACK.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.PASSWORD") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.PASSWORD.TEXT") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.DELETE") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.DELETE.TEXT1") }}</p>
              <p>{{ translate("HELP.DELETE.TEXT2") }}</p>
            </div>

            <h2>{{ translate("HELP.GRIPES") }}:</h2>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.SLOW") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.SLOW.TEXT1") }}</p>
              <p>{{ translate("HELP.SLOW.TEXT2") }}</p>
            </div>
            <button type="button" class="collapsible-help-item">{{ translate("HELP.JAVA") }}</button>
            <div class="help-item-content">
              <p>{{ translate("HELP.JAVA.TEXT1") }}</p>
              <p>{{ translate("HELP.JAVA.TEXT2") }}</p>
            </div>

        </div>
    </div>
</div>
</transition>
</template>

<script>
const i18n = require("../../i18n/index.js");
module.exports = {
    components: {
    },
    mixins:[i18n],
    data() {
        return {
        }
    },
    mounted() {
        var coll = document.getElementsByClassName("collapsible-help-item");
        for (var i = 0; i < coll.length; i++) {
          coll[i].addEventListener("click", function() {
            this.classList.toggle("active-help-item");
            var content = this.nextElementSibling;
            if (content.style.display === "block") {
              content.style.display = "none";
            } else {
              content.style.display = "block";
            }
          });
        }
    },
    methods: {
        close: function () {
            this.$store.commit("SET_MODAL", false);
        }
    }
}
</script>
<style>
.help-link:link {
    text-decoration: underline;
}
.collapsible-help-item {
  background-color: #26b99a;
  color: white;
  cursor: pointer;
  padding: 20px;
  margin: 10px;
  width: 95%;
  border: none;
  text-align: left;
  outline: none;
  font-size: 15px;
}
.active-help-item, .collapsible-help-item:hover {
  background-color: #5cb85c;
}
.help-item-content {
  padding: 0 20px;
  display: none;
  overflow: hidden;
  background-color: var(--bg);
  color: var(--color);
}
</style>
