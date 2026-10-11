<template>
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog group-editor" role="dialog" aria-modal="true" :aria-label="displayedTitle" @click.stop>
        <header class="pg-dialog__head">
            <h2 class="pg-dialog__title">{{ displayedTitle }}</h2>
            <button v-if="isAdmin && allowTitleChange" type="button" class="group-editor__rename" aria-label="Rename" title="Rename" @click="changeGroupTitle()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <DialogClose @close="close"/>
        </header>

        <div class="pg-dialog__body group-editor__body">
            <section class="group-editor__section">
                <div class="group-editor__add">
                    <FormAutocomplete
                            is-multiple
                            v-model="targetUsernames"
                            :options="friendNames"
                            :maxitems="5"
                            placeholder="please select user"
                    />
                    <button type="button" class="pg-btn pg-btn--primary" :disabled="targetUsernames.slice().length == 0" @click="addUsersToGroup()">{{ addLabel }}</button>
                </div>
                <div v-if="isAdmin && !isTemplateApp" class="group-editor__choice" role="radiogroup" aria-label="Add as">
                    <label class="pg-switch">
                        <input type="radio" value="Member" v-model="memberAccess">
                        <span class="pg-switch__track" aria-hidden="true"></span>
                        <span>Member</span>
                    </label>
                    <label class="pg-switch" title="Admins can change title and membership">
                        <input type="radio" value="Admin" v-model="memberAccess">
                        <span class="pg-switch__track" aria-hidden="true"></span>
                        <span>Admin</span>
                    </label>
                </div>
            </section>

            <section v-if="isTemplateApp" class="group-editor__section">
                <h3 class="group-editor__heading">Admins</h3>
                <ul class="group-editor__people">
                    <li v-for="user in existingAdmins" :key="user" class="group-editor__person">
                        <span class="group-editor__name">{{ user }}</span>
                    </li>
                </ul>
            </section>
            <section v-if="isAdmin && !isTemplateApp" class="group-editor__section">
                <h3 class="group-editor__heading">Admins</h3>
                <ul class="group-editor__people">
                    <li v-for="user in existingAdmins" :key="user" class="group-editor__person">
                        <label class="group-editor__pick">
                            <input :disabled="existingAdmins.length <= 1" type="checkbox" :value="user" v-model="adminsToRemove">
                            <span class="group-editor__name">{{ user }}</span>
                        </label>
                    </li>
                </ul>
                <div class="group-editor__actions">
                    <button type="button" class="pg-btn" :disabled="existingAdmins.length <= 1 || adminsToRemove.length == 0" @click="removeAdminFromGroup()">Remove</button>
                </div>
            </section>
            <section class="group-editor__section">
                <h3 class="group-editor__heading">Members</h3>
                <ul class="group-editor__people">
                    <li v-for="user in existingGroupMembers" :key="user" class="group-editor__person">
                        <label class="group-editor__pick">
                            <input :disabled="!( (isAdmin && user != context.username) || (!isAdmin && user == context.username))" type="checkbox" :value="user" v-model="membersSelected">
                            <span class="group-editor__name">{{ user }}</span>
                        </label>
                    </li>
                </ul>
                <div class="group-editor__actions">
                    <button type="button" class="pg-btn" :disabled="membersSelected.length == 0" @click="removeUserFromGroup()">Remove</button>
                    <button v-if="isAdmin && !isTemplateApp" type="button" class="pg-btn" :disabled="membersSelected.length == 0" @click="promoteToGroupAdmin()">Promote to Admin</button>
                </div>
            </section>
            <AppPrompt
                    v-if="showPrompt"
                    v-on:hide-prompt="showPrompt = false"
                    :message="prompt_message"
                    :placeholder="prompt_placeholder"
                    :max_input_size="prompt_max_input_size"
                    :value="prompt_value"
                    :consumer_func="prompt_consumer_func"/>
            <Error
                    v-if="showError"
                    v-on:hide-error="showError = false"
                    :title="errorTitle"
                    :body="errorBody">
            </Error>
        </div>
        <footer class="pg-dialog__foot">
            <slot name="footer">
                <div class="pg-dialog__actions">
                    <span class="pg-dialog__spacer"></span>
                    <button type="button" class="pg-btn pg-btn--primary" @click="updateGroupMembership">{{ updateLabel }}</button>
                </div>
            </slot>
        </footer>
        <div v-if="showSpinner" class="pg-dialog__loading"><Spinner></Spinner></div>
    </div>
</div>
</template>

<script>
const AppPrompt = require("../components/prompt/AppPrompt.vue");
const DialogClose = require("../components/dialog/DialogClose.vue");
const Error = require("../components/error/Error.vue");
const FormAutocomplete = require("../components/form/FormAutocomplete.vue");
const Spinner = require("../components/spinner/Spinner.vue");


module.exports = {
	components: {
	    AppPrompt,
	    DialogClose,
	    Error,
	    FormAutocomplete,
	    Spinner
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
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            displayedTitle: "",
            updateLabel: "Apply Changes",
            addLabel: "Invite",
            genericLabel: "chat",
            isAdmin: false,
            memberAccess: "Member",
            allowTitleChange: true,
        }
    },
    props: ['existingGroups', 'groupId', 'groupTitle', 'existingGroupMembers', 'friendNames'
        , 'updatedGroupMembership', 'existingAdmins', 'isTemplateApp'],
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
        if (this.isTemplateApp) {
            this.allowTitleChange = false;
        }
    },
    methods: {
        updateGroupMembership: function () {
            if (this.groupId == "") {
                if (this.displayedTitle == this.groupTitle) {
                    if (this.existingGroupMembers.length == 1 || this.existingGroupMembers.length > 2) {
                        this.showMessage(true, "Click on title to set " + this.genericLabel + " name");
                    } else {
                        this.updatedGroupMembership(this.groupId, this.existingGroupMembers[1], this.existingGroupMembers.slice()
                            , this.existingAdmins.slice());
                    }
                } else {
                    this.updatedGroupMembership(this.groupId, this.displayedTitle, this.existingGroupMembers.slice()
                        , this.existingAdmins.slice());
                }
            } else {
                this.updatedGroupMembership(this.groupId, this.displayedTitle, this.existingGroupMembers.slice()
                    , this.existingAdmins.slice());
            }
        },
        changeGroupTitle: function () {
            if (!this.isAdmin || !this.allowTitleChange) {
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
            let selectedSelf = this.membersSelected.indexOf(this.context.username) > -1;
            let otherMembersToRemove = this.membersSelected.slice().filter(v => v !== this.context.username);
            for (var i = 0; i < otherMembersToRemove.length; i++) {
                let targetUsername = otherMembersToRemove[i];
                if (targetUsername != this.context.username) {
                    var index = this.existingAdmins.indexOf(targetUsername);
                    if (this.isAdmin) {
                        if (index > -1) {
                            this.existingAdmins.splice(index, 1);
                        }
                        index = this.existingGroupMembers.indexOf(targetUsername);
                        if (index > -1) {
                            this.existingGroupMembers.splice(index, 1);
                        }
                    } else {
                        if (index > -1) {
                            this.errorTitle = "Only an Admin can remove an Admin";
                            this.errorBody = "";
                            this.showError = true;
                            return;
                        } else {
                            index = this.existingGroupMembers.indexOf(targetUsername);
                            if (index > -1) {
                                this.existingGroupMembers.splice(index, 1);
                            }
                        }
                    }
                }
            }
            if (selectedSelf) {
                if (!this.isAdmin) {
                    index = this.existingGroupMembers.indexOf(this.context.username);
                    if (index > -1) {
                        this.existingGroupMembers.splice(index, 1);
                    }
                }
            }
            this.membersSelected = [];
        },
        promoteToGroupAdmin : function () {
            let usersToAdd = [];
            for (var i = 0; i < this.membersSelected.length; i++) {
                usersToAdd.push(this.membersSelected[i]);
            }
            this.addAdminsToGroup(usersToAdd);
            this.membersSelected = [];
        },
        removeAdminFromGroup : function () {
            if (!this.isAdmin) {
                return;
            }
            if (this.existingAdmins.length == this.adminsToRemove.length) {
                this.errorTitle = "A group must have at least 1 admin";
                this.errorBody = "";
                this.showError = true;
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
            for (var i = usersToAdd.length - 1; i >= 0; i--) {
                let targetUsername = usersToAdd[i];
                if(this.existingGroupMembers.indexOf(targetUsername) > -1) {
                    usersToAdd.splice(i, 1);
                } else {
                    this.existingGroupMembers.push(targetUsername);
                }
            }
            if (usersToAdd.length == 0) {
                this.errorTitle = "Already a member!";
                this.errorBody = "";
                this.showError = true;
            } else {
                this.targetUsernames = [];
            }
        },
        addAdminsToGroup: function(usersToAdd) {
            if (!this.isAdmin) {
                return;
            }
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
                this.errorTitle = "Already an Admin!";
                this.errorBody = "";
                this.showError = true;
            } else {
                this.addMembersToGroup(membersToAdd);
            }
        }
    }
}
</script>

<style>
.group-editor {
    position: relative;
    width: 520px;
}
.group-editor__body {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding-bottom: 16px;
}
.group-editor__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
}
/* the same small caps the share and secret link dialogs label their sections with */
.group-editor__heading {
    margin: 0;
    font-size: 11px;
    font-weight: var(--bold);
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--pg-muted);
}
.group-editor__choice,
.group-editor__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
/* the picker and its button on one line, as in Add to chat */
.group-editor__add {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}
.group-editor__add .form-autocomplete {
    flex: 1 1 auto;
    min-width: 0;
    margin-bottom: 0;
}
.group-editor__add > .pg-btn {
    flex: none;
}
.group-editor__people {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--border-color);
    border-radius: 12px;
}
.group-editor__person {
    padding: 10px 14px;
}
.group-editor__person + .group-editor__person {
    border-top: 1px solid var(--pg-track);
}
.group-editor__pick {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    margin: 0;
    font-weight: var(--regular);
    cursor: pointer;
}
.group-editor__pick input {
    flex: none;
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--green-500);
}
.group-editor__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
}
/* drawn like the close button beside it */
.group-editor__rename {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    margin-top: -6px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background-color: transparent;
    color: var(--pg-muted);
    cursor: pointer;
}
.group-editor__rename:hover {
    background-color: var(--pg-surface-2);
    color: var(--color);
}
.group-editor__rename:focus-visible {
    outline: 2px solid var(--green-500);
    outline-offset: 2px;
}
.group-editor__rename svg {
    width: 18px;
    height: 18px;
}
</style>
