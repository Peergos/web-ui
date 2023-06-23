<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;">
        <div class="modal-header" style="padding:0">
            <center><h2>Help/FAQ</h2></center>
            <span @click="close" tabindex="0" v-on:keyup.enter="close" style="position:absolute;top:-10px;right:40px;z-index:999;color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>
        </div>
        <div class="modal-body">
            <h2>How do I...</h2>
            <button type="button" class="collapsible-help-item">Upgrade my Account?</button>
            <div class="help-item-content">
              <p>Select 'Account' menu item after clicking on the user settings menu (the person icon in the top right-hand corner). Alternatively click on the bottom left of the screen you should see a 'UPGRADE' button. Follow the contents of the modal that appears to request space/upgrade/downgrade your account.</p>
            </div>
            <button type="button" class="collapsible-help-item">See how much space I have used/have available?</button>
            <div class="help-item-content">
              <p>On the top left you will see the Peergos logo of a tower. Click it to expand the left panel. At the bottom of the expanded panel it will display 99.9 KiB / 999.9 MiB where the first number is your usage and the second number is your available space. </p>
            </div>
            <button type="button" class="collapsible-help-item">Send a follow request?</button>
            <div class="help-item-content">
              <p>The social view is displayed via selecting the 3 connected dots icon on the left side menu. On the social page you can send a follow request and view any pending requests you have received.</p>
            </div>
            <button type="button" class="collapsible-help-item">View my friends and followers?</button>
            <div class="help-item-content">
              <p>The social modal is displayed via selecting the 3 connected dots icon on the left side menu. Your social connections will be listed under Friends, Followers and Following.</p>
              <p>If you sent a follow request and the recipient clicked 'allow and follow back' then you become friends.</p>
            </div>
            <button type="button" class="collapsible-help-item">Create and share a Profile?</button>
            <div class="help-item-content">
              <p>Select 'Profile' menu item after clicking on the user settings menu (the person icon in the top right-hand corner). Add desired details and click save. Profile image will be previewed after upload. Click the share button next to each completed field to set the viewable audience.</p>
              <p>You can view someone else's profile via the links generated on the social view or on the newsfeed view.</p>
            </div>
            <button type="button" class="collapsible-help-item">Share a file/folder with another Peergos user?</button>
            <div class="help-item-content">
              <p>Each file/folder icon in the drive will have a vertical 3 dot menu in the top right. From the context menu that appears, select Share. You can grant access to other users individually or in groups. Access can be for read only or read & write access. The recipient can on-share a shared file for read only access.</p>
              <p>When sharing a folder, sub-folders are automatically shared.</p>
              <p>Who has access and the level of access granted is also displayed on this modal.</p>
            </div>
            <button type="button" class="collapsible-help-item">View files/folders shared with me?</button>
            <div class="help-item-content">
              <p>Select the newsfeed icon on the left menu. It will take some time to assemble a custom page consisting of the posts sent to you. The posts may be messages or links to files/folders shared with you.</p>
              <p>Alternatively if you know the username of the person who shared the file/folder, select the globe icon on top toolbar and navigate to their drive space.</p>
            </div>
            <button type="button" class="collapsible-help-item">Share a secret link to a file/folder?</button>
            <div class="help-item-content">
              <p>Each file/folder icon in the drive will have a vertical 3 dot menu in the top right. From the context menu that appears, select Share. At the bottom of the modal, select the 'Create secret link' button.</p>
              <p>The link can be pasted directly into a browser tab. If the link is to a folder, the sub-solders will also be visible to the recipient of the secret link</p>
            </div>
            <button type="button" class="collapsible-help-item">Configure a Calendar?</button>
            <div class="help-item-content">
              <p>From the calendar view, click the gears icon in the toolbar. Select the 'Calendar Settings' button to display the currently configured Calendars.</p>
              <p>Selecting the dot next to each calendar will allow you to change the color to associate to the calendar. Clicking the calendar name will display a dialog to set a new name for the calendar.</p>
            </div>
            <button type="button" class="collapsible-help-item">Share a whole calendar?</button>
            <div class="help-item-content">
              <p>Your primary calendar cannot be shared. You can create multiple calendars. From the calendar view, click the gears icon in the toolbar. Select the 'Calendar Settings' button to display the currently configured Calendars.</p>
              <p>Click the share button to set the read-only audience for the calendar</p>
              <p>Calendars shared with you will first need to be imported via the newsfeed view</p>
            </div>
            <button type="button" class="collapsible-help-item">Share a calendar event?</button>
            <div class="help-item-content">
              <p>After creating a calendar event. Select the share link on the event context menu to set the audience.</p>
              <p>Calendar events shared with you will first need to be imported via the newsfeed view. The imported event is a copy of the event.</p>
            </div>
            <button type="button" class="collapsible-help-item">Import a calendar event?</button>
            <div class="help-item-content">
              <p>To import an event shared with you via another Peergos user, first open the newsfeed and select the event</p>
              <p>To import an .ics file, open the calendar view and select the gears icon in the toolbar. Select the 'Calendar Settings' button to display the currently configured Calendars. From here click the 'import' button</p>
              <p>An .ics file containing multiple entries is supported. Different calendar implementations (including ours!) have varying level of support/compliance.</p>
            </div>
            <button type="button" class="collapsible-help-item">Share a Task/Todo list?</button>
            <div class="help-item-content">
              <p>Task/Todo lists are saved by default to the root directory of your Drive space. Click the vertical 3 dot icon in the top right of the desired Task/Todo item and select Share</p>
            </div>
            <button type="button" class="collapsible-help-item">Host a directory as a static website?</button>
            <div class="help-item-content">
              <p>Select 'Profile' menu item after clicking on the user settings menu (the person icon in the top right-hand corner). At the bottom of the modal you will see a field titled 'Website Directory'. After setting the field and selecting Save, a Publish button will appear alongside the same field.</p>
              <p>Click the publish button to complete the action</p>
              <p>NOTE: Publishing will make the folder and any sub-folders and all its contents public!</p>
              <p>Clear the text field and click Save to reset</p>
              <p>See This blog <a class="help-link" href="https://peergos.org/posts/p2p-web-hosting" target="_blank" rel="noopener noreferrer">post</a> for more details</p>
            </div>
            <button type="button" class="collapsible-help-item">Clean up failed uploads?</button>
            <div class="help-item-content">
              <p>A failed upload will continue to consume Drive space. To free the attached space, select the 'Cleanup failed uploads' menu item from the user settings menu</p>
            </div>
            <button type="button" class="collapsible-help-item">Recreate a media thumbnail image?</button>
            <div class="help-item-content">
              <p>The upload process will attempt to create a thumbnail image for image or video files. Various conditions/factors may conspire to render this unsuccessful. If this is the case, an additional 'Create Thumbnail' context menu item will be available. This process is also subject to conditions/factors which may prevent the creation of a thumbnail image.</p>
            </div>
            <button type="button" class="collapsible-help-item">Provide feedback?</button>
            <div class="help-item-content">
              <p>A feedback form is available via the 'Feedback' menu item on the user settings menu.</p>
            </div>
            <button type="button" class="collapsible-help-item">Change my password?</button>
            <div class="help-item-content">
              <p>See 'Change Password' menu item on the user settings menu.</p>
            </div>
            <button type="button" class="collapsible-help-item">Delete my account?</button>
            <div class="help-item-content">
              <p>See 'Delete Account' menu item on the user settings menu.</p>
              <p>NOTE: All YOUR data will be deleted and your account with be irretrievable.</p>
            </div>

            <h2>Gripes/Concerns:</h2>
            <button type="button" class="collapsible-help-item">Why is everything so slow?</button>
            <div class="help-item-content">
              <p>It isn't! The whole story is always more complicated. In an end-to-end encrypted and peer-to-peer system, the client is required to do a lot of work (and not just decrypting/encryption). If you are technically minded, open the browser console and watch the stream of 100's of requests to get a flavour.</p>
              <p>There are still a lot of speed improvements we are planning on implementing. Performance will also improve as browsers implement some of the primitives we need for signing and encryption.</p>
            </div>
            <button type="button" class="collapsible-help-item">I heard Peergos is written in Java, are you crazy?</button>
            <div class="help-item-content">
              <p>In fact Java is an ideal language for Peergos. The JVM is rock solid and provides good performance and resource utilization. The client is written mostly in java and trans-compiled to Javascript via the battle-hardened GWT</p>
              <p>Having a single language codebase for server and most of the client has multiple benefits. We are not language zealots, other choices would be appropriate in different circumstances.</p>
            </div>

        </div>
    </div>
</div>
</transition>
</template>

<script>
import { inject } from 'vue'
const store = inject('store')
    
export default {
    components: {
    },
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
            store.commit("SET_MODAL", false);
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
