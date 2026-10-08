<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog add-to-chat" role="dialog" aria-modal="true" :aria-label="title + appDisplayName" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{ title }}{{ appDisplayName }}</h3>
            <DialogClose @close="close"/>
        </header>
        <Spinner v-if="showSpinner"></Spinner>
        <div class="pg-dialog__body add-to-chat__body">
            <div class="add-to-chat__pick">
                <FormAutocomplete
                        is-multiple
                        v-model="targetUsernames"
                        :options="friendNames"
                        :maxitems="friendsToAddCount"
                        placeholder="please select user"
                />
                <button type="button" class="pg-btn" :disabled="targetUsernames.slice().length == 0" @click="addFriends">{{ addLabel }}</button>
            </div>
            <p class="pg-note">{{ friendsToAddCount }} more can be invited.</p>
            <section class="add-to-chat__invited" aria-label="Invited">
                <h4 class="add-to-chat__label">Invited</h4>
                <ul v-if="addedFriends.length > 0" class="add-to-chat__people">
                    <li v-for="user in addedFriends" :key="user" class="add-to-chat__person">
                        <span class="add-to-chat__name">{{ user }}</span>
                        <button type="button" class="pg-btn pg-btn--quiet" :aria-label="'Remove ' + user" @click="removeFriend(user)">Remove</button>
                    </li>
                </ul>
                <p v-else class="pg-note">Nobody yet.</p>
            </section>
        </div>
        <footer class="pg-dialog__foot">
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" class="pg-btn" @click="close">Cancel</button>
                <button type="button" class="pg-btn pg-btn--primary" @click="applyChange">{{ updateLabel }}</button>
            </div>
        </footer>
    </div>
</div>
</transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");
const FormAutocomplete = require("../form/FormAutocomplete.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
	components: {
        DialogClose,
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
        removeFriend: function(user) {
            this.friendsSelected = [user];
            this.removeFriends();
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
            // include a friend picked in the box but not yet added with the invite button
            this.addFriends();
            this.updateChat(this.addedFriends, this.chatTitle);
            this.close();
        }
    }
}
</script>
<style>
/* Who to invite on one line with the button that adds them, then who is in so far, each with
   a way to take them out again. */
.add-to-chat {
	width: 560px;
}

.add-to-chat__body {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.add-to-chat__pick {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}

/* the field's own gap below suits a form, not a line with a button beside it */
.add-to-chat__pick .form-autocomplete {
	flex: 1 1 auto;
	min-width: 0;
	margin-bottom: 0;
}

.add-to-chat__pick > .pg-btn {
	flex: none;
	min-height: 44px;
}

.add-to-chat__invited {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding-top: 12px;
	border-top: 1px solid var(--pg-track);
}

.add-to-chat__label {
	margin: 0;
	font-size: 10px;
	font-weight: var(--regular);
	text-transform: uppercase;
	letter-spacing: .07em;
	color: var(--pg-muted);
}

.add-to-chat__people {
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	list-style: none;
}

.add-to-chat__person {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 4px 0;
}

.add-to-chat__name {
	min-width: 0;
	overflow-wrap: anywhere;
}
</style>
