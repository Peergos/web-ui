<template>
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="overflow-y:auto; max-width:1000px;">
        <span @click="close" class="close">&times;</span>
        <Spinner v-if="showSpinner"></Spinner>
        <div class="modal-header">
            <span>
                <h4 style="text-align: center;">{{ title }}&nbsp;{{ appDisplayName}}</h4>
            </span>
        </div>
        <div class="modal-body">
            <div class="container">
              <div class="flex-container">
                    <FormAutocomplete
                            is-multiple
                            v-model="targetUsernames"
                            :options="friendNames"
                            :maxitems="friendsToAddCount"
                            placeholder="please select user"
                    />
                <div style="padding:5px; margin-top: 10px;">
                  <button :disabled="this.targetUsernames.slice().length == 0" class="btn btn-success" @click="addFriends"> {{ addLabel }}</button>
                </div>
              </div>
            </div>
            <div class="modal-prominent">
                <div class="container" v-if="addedFriends.length > 0"><p style="word-wrap;break-all;">
                    Invited:</p>
                    <div v-for="user in addedFriends">
                        <label class="checkbox__group">
                            <input type="checkbox" v-bind:id="user" v-bind:value="user" v-model="friendsSelected">
                            <span class="checkmark"></span>
                            <span style="margin-left:10px">{{ user }}</span>
                        </label>
                    </div>
                    <button :disabled="this.friendsSelected.length == 0" class="btn btn-success" v-on:click="removeFriends()">Remove</button>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <slot name="footer">
                <button class="btn btn-success" @click="applyChange">
                    {{ updateLabel }}
                </button>
            </slot>
        </div>
    </div>
</div>
</template>

<script>
const FormAutocomplete = require("../form/FormAutocomplete.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
	components: {
	    FormAutocomplete,
	    Spinner
	},
    data() {
        return {
            showSpinner: false,
            targetUsernames: [],
            addedFriends: [],
            friendsSelected: [],
            friendsToAddCount: 0,
            title: "Add Friends to: ",
            updateLabel: "Apply",
            addLabel: "Invite to App",
        }
    },
    props: ['appDisplayName', 'maxFriendsToAdd', 'chatTitle', 'friendNames', 'updateChat'],
    computed: {
        ...Vuex.mapState([
            'context',
        ])
    },
    created: function() {
        this.friendsToAddCount = this.maxFriendsToAdd;
    },
    methods: {
        close: function () {
            this.$emit("hide-add-to-chat");
        },
        addFriends: function() {
            var usersToAdd = this.targetUsernames.slice();
            for (var i = usersToAdd.length - 1; i >= 0; i--) {
                let targetUsername = usersToAdd[i];
                if(this.addedFriends.indexOf(targetUsername) == -1 && this.friendsToAddCount > 0) {
                    this.addedFriends.push(targetUsername);
                    this.friendsToAddCount--;
                }
            }
            this.targetUsernames = [];
        },
        removeFriends : function () {
            for (var i = 0; i < this.friendsSelected.length; i++) {
                let targetUsername = this.friendsSelected[i];
                let index = this.addedFriends.indexOf(targetUsername);
                if (index > -1) {
                    this.addedFriends.splice(index, 1);
                    this.friendsToAddCount++;
                }
            }
            this.friendsSelected = [];
        },
        applyChange: function() {
            this.updateChat(this.addedFriends, this.chatTitle);
            this.close();
        }
    }
}
</script>
<style>
</style>