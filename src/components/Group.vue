<template>
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="overflow-y:auto; max-width:1000px;">
        <span @click="close" class="close">&times;</span>
        <spinner v-if="showSpinner"></spinner>
        <prompt
                v-if="showPrompt"
                v-on:hide-prompt="showPrompt = false"
                :prompt_message='prompt_message'
                :placeholder="prompt_placeholder"
                :max_input_size="prompt_max_input_size"
                :value="prompt_value"
                :consumer_func="prompt_consumer_func">
        </prompt>
        <div class="modal-header">
            <span>
                <h4 style="text-align: center;" @click="changeGroupTitle()">{{ displayedTitle }}&nbsp;&nbsp;<i v-if="isAdmin" @click="changeGroupTitle()" class="fa fa-edit" aria-hidden="true"></i></h4>

            </span>
        </div>

        <div class="modal-body">
            <div class="container">
              <div class="flex-container">
                    <FormAutocomplete
                            is-multiple
                            v-model="targetUsernames"
                            :options="friendNames"
                            :maxitems="5"
                            placeholder="please select user"
                    />
                  <div class="hspace-5" v-if="isAdmin" style="margin-top: 20px;">
                      <input type="radio" id="member-access" value="Member" v-model="memberAccess">
                      <label for="member-access" style="font-weight: normal;">Member</label>
                  </div>
                  <div class="hspace-5" v-if="isAdmin"  style="margin-top: 20px;">
                      <input type="radio" id="admin-access" value="Admin" v-model="memberAccess">
                      <label for="admin-access" style="font-weight: normal;" data-toggle="tooltip" data-placement="bottom" title="Admins can change chat title and membership">Admin</label>
                  </div>
                <div style="padding:5px; margin-top: 10px;">
                  <button :disabled="this.targetUsernames.slice().length == 0" class="btn btn-success" @click="addUsersToGroup()"> {{ addLabel }}</button>
                </div>
              </div>
            </div>
            <div v-if="isAdmin" class="modal-prominent">
                <div class="container" ><p style="word-wrap;break-all;">
                    Admins:</p>
                    <div v-for="user in existingAdmins">
                        <input :disabled="existingAdmins.length <= 1" type="checkbox" v-bind:id="user" v-bind:value="user" v-model="adminsToRemove"><span style="margin-left:10px">{{ user }}</span>
                    </div>
                    <button :disabled="existingAdmins.length <= 1 || adminsToRemove.length == 0" class="btn btn-success" v-on:click="removeAdminFromGroup()">Remove</button>
                </div>
            </div>
            <div class="modal-prominent">
                <div class="container" v-if="existingGroupMembers.length > 0"><p style="word-wrap;break-all;">
                    Members:</p>
                    <div v-if="!haveRemovedSelf">
                        <input :disabled="isAdmin" v-if="!haveRemovedSelf" type="checkbox" v-bind:value="context.username" v-model="selectSelf"><span  v-if="!haveRemovedSelf" style="margin-left:10px">{{ context.username }}</span>
                    </div>
                    <div v-for="user in existingGroupMembers">
                        <input :disabled="!isAdmin"  type="checkbox" v-bind:id="user" v-bind:value="user" v-model="membersSelected"><span style="margin-left:10px">{{ user }}</span>
                    </div>
                    <button :disabled="this.membersSelected.length == 0 && this.selectSelf.length == 0" class="btn btn-success" v-on:click="removeUserFromGroup()">Remove</button>
                    <button v-if="isAdmin" :disabled="this.membersSelected.length == 0 && this.selectSelf.length == 0" class="btn btn-info" v-on:click="promoteToGroupAdmin()">Promote to Admin</button>
                </div>
                <div class="container" v-if="existingGroupMembers.length == 0"><p style="word-wrap;break-all;">
                    Members:</p>
                    <div v-if="!haveRemovedSelf">
                        <input :disabled="isAdmin" v-if="!haveRemovedSelf" type="checkbox" v-bind:value="context.username" v-model="selectSelf"><span  v-if="!haveRemovedSelf" style="margin-left:10px">{{ context.username }}</span>
                    </div>
                    <button v-if="!haveRemovedSelf" :disabled="this.selectSelf.length == 0" class="btn btn-success" v-on:click="removeUserFromGroup()">Remove</button>
                </div>
            </div>
            <error
                    v-if="showError"
                    v-on:hide-error="showError = false"
                    :title="errorTitle"
                    :body="errorBody">
            </error>
        </div>
        <div class="modal-footer">
            <slot name="footer">
                <button class="btn btn-success" @click="updateGroupMembership">
                    {{ updateLabel }}
                </button>
            </slot>
        </div>
    </div>
</div>
</template>

<script>
const FormAutocomplete = require("../components/form/FormAutocomplete.vue");
const routerMixins = require("../mixins/router/index.js");

module.exports = {
	components: {
	    FormAutocomplete,
	},
    data() {
        return {
            showSpinner: false,
            targetUsername: "",
            targetUsernames: [],
            errorTitle:'',
            errorBody:'',
            showError:false,
            membersSelected: [],
            adminsToRemove: [],
            selectSelf: [],
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            displayedTitle: "",
            updateLabel: "Apply Changes",
            addLabel: "Invite to Chat",
            genericLabel: "chat",
            isAdmin: false,
            haveRemovedSelf: false,
            memberAccess: "Member"
        }
    },
    props: ['existingGroups', 'groupId', 'groupTitle', 'existingGroupMembers', 'friendNames'
        , 'updatedGroupMembership', 'existingAdmins'],
    computed: {
        ...Vuex.mapState([
            'context',
        ])
    },
    created: function() {
        this.displayedTitle = this.groupTitle;
        if (this.groupId == "") {
            this.updateLabel = "Create";
        }
        this.isAdmin = this.existingAdmins.findIndex(v => v === this.context.username) > -1;
    },
    methods: {
        updateGroupMembership: function () {
            if (this.groupId == "" && this.displayedTitle == this.groupTitle) {
                this.showMessage(true, "Click on title to set " + this.genericLabel + " name");
            } else {
                this.updatedGroupMembership(this.groupId, this.displayedTitle, this.existingGroupMembers.slice()
                    , this.existingAdmins.slice(), this.haveRemovedSelf);
                this.close();
            }
        },
        changeGroupTitle: function () {
            if (!this.isAdmin) {
                return;
            }
            let that = this;
            this.prompt_placeholder = 'New ' + this.genericLabel + ' name';
            this.prompt_value = this.displayedTitle;
            this.prompt_message = 'Enter a name';
            this.prompt_max_input_size = 20;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                if (prompt_result === this.displayedTitle)
                    return;
                let newName = prompt_result.trim();
                if (newName === '')
                    return;
                if (newName === '.' || newName === '..')
                    return;
                if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                    that.showMessage(true, "Invalid " + that.genericLabel + " name. Use only alphanumeric characters plus space, dash and underscore");
                    return;
                }
                setTimeout(function(){
                    //make sure names are unique
                    for (var i=0;i < that.existingGroups.length; i++) {
                        let existingGroupName = that.existingGroups[i];
                        if (existingGroupName == newName) {
                            that.showMessage(true, "Duplicate " + that.genericLabel + " name");
                            return;
                        }
                    }
                    that.displayedTitle = newName;
                });
            };
            this.showPrompt =  true;
        },
        close: function () {
            this.$emit("hide-group");
        },
        showMessage : function (isError, title, body) {
            let bodyContents = body == null ? '' : ' ' + body;
            if (isError) {
                this.$toast.error(title + bodyContents, {timeout:false});
            } else {
                this.$toast(title + bodyContents)
            }
        },
        removeUserFromGroup : function () {
            if(this.selectSelf.length > 0) {
                this.haveRemovedSelf = true;
            }
            for (var i = 0; i < this.membersSelected.length; i++) {
                let targetUsername = this.membersSelected[i];
                let index = this.existingGroupMembers.indexOf(targetUsername);
                if (index > -1) {
                    this.existingGroupMembers.splice(index, 1);
                }
                index = this.existingAdmins.indexOf(targetUsername);
                if (index > -1) {
                    this.existingAdmins.splice(index, 1);
                }
            }
            this.membersSelected = [];
        },
        promoteToGroupAdmin : function () {
            let usersToAdd = [];
            if(this.selectSelf.length > 0) {
                usersToAdd.push(this.context.username);
            }
            for (var i = 0; i < this.membersSelected.length; i++) {
                let targetUsername = this.membersSelected[i];
                usersToAdd.push(targetUsername);
            }
            this.addAdminsToGroup(usersToAdd);
            this.membersSelected = [];
        },
        removeAdminFromGroup : function () {
            if (!this.isAdmin) {
                return;
            }
            for (var i = 0; i < this.adminsToRemove.length; i++) {
                let targetUsername = this.adminsToRemove[i];
                let index = this.existingAdmins.indexOf(targetUsername);
                if (index > -1) {
                    this.existingAdmins.splice(index, 1);
                }
            }
            this.adminsToRemove = [];
        },
        addUsersToGroup: function() {
            var usersToAdd = this.targetUsernames.slice();
            if (usersToAdd.length == 0) {
                return;
            }
            if (this.memberAccess == "Member") {
                this.addMembersToGroup(usersToAdd);
            } else {
                this.addAdminsToGroup(usersToAdd);
            }
        },
        addMembersToGroup: function(usersToAdd) {
            if (usersToAdd.length == 0) {
                return;
            }
            var that = this;
            for (var i = usersToAdd.length - 1; i >= 0; i--) {
                let targetUsername = usersToAdd[i];
                if(this.existingGroupMembers.indexOf(targetUsername) > -1) {
                    usersToAdd.splice(i, 1);
                } else {
                    this.existingGroupMembers.push(targetUsername);
                }
            }
            if (usersToAdd.length == 0) {
                that.errorTitle = "Already a member!";
                that.errorBody = "";
                that.showError = true;
            } else {
                this.targetUsernames = [];
            }
        },
        addAdminsToGroup: function(usersToAdd) {
            if (!this.isAdmin) {
                return;
            }
            var that = this;
            let membersToAdd = [];
            for (var i = 0; i < usersToAdd.length; i++) {
                let targetUsername = usersToAdd[i];
                if(this.existingGroupMembers.indexOf(targetUsername) == -1) {
                    membersToAdd.push(targetUsername);
                }
            }

            for (var i = usersToAdd.length - 1; i >= 0; i--) {
                let targetUsername = usersToAdd[i];
                if(this.existingAdmins.indexOf(targetUsername) > -1) {
                    usersToAdd.splice(i, 1);
                } else {
                    this.existingAdmins.push(targetUsername);
                }
            }
            if (usersToAdd.length == 0) {
                that.errorTitle = "Already an Admin!";
                that.errorBody = "";
                that.showError = true;
            } else {
                this.addMembersToGroup(membersToAdd);
            }
        }
    }
}
</script>

<style>


</style>