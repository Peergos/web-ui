<template>
	<AppModal :title="translate('HELP.TITLE')" wide>
		<template #body>
			<section v-for="section in sections" :key="section.title" class="help__section">
				<h4 class="help__heading">{{ translate(section.title) }}{{ section.suffix }}</h4>
				<details v-for="item in section.items" :key="item.q" class="help__item">
					<summary>{{ translate(item.q) }}</summary>
					<div class="help__answer">
						<p v-for="key in item.a" :key="key">{{ translate(key) }}<template v-if="links[key]">: <a class="help-link" :href="links[key]" target="_blank" rel="noopener noreferrer">{{ links[key] }}</a></template></p>
					</div>
				</details>
			</section>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const i18n = require("../../i18n/index.js");
module.exports = {
    components: {
        AppModal,
    },
    mixins:[i18n],
    data() {
        return {
            sections: [
                {title: 'HELP.HOW', suffix: '', items: [
                    {q: 'HELP.UPGRADE', a: ['HELP.UPGRADE.TEXT']},
                    {q: 'HELP.SPACE', a: ['HELP.SPACE.TEXT']},
                    {q: 'HELP.FOLLOW', a: ['HELP.FOLLOW.TEXT']},
                    {q: 'HELP.FRIENDS', a: ['HELP.FRIENDS.TEXT1', 'HELP.FRIENDS.TEXT2']},
                    {q: 'HELP.PROFILE', a: ['HELP.PROFILE.TEXT1', 'HELP.PROFILE.TEXT2']},
                    {q: 'HELP.SHARE', a: ['HELP.SHARE.TEXT1', 'HELP.SHARE.TEXT2', 'HELP.SHARE.TEXT3']},
                    {q: 'HELP.SHARED.FILES', a: ['HELP.SHARED.FILES.TEXT1', 'HELP.SHARED.FILES.TEXT2']},
                    {q: 'HELP.LINK', a: ['HELP.LINK.TEXT1', 'HELP.LINK.TEXT2']},
                    {q: 'HELP.CAL', a: ['HELP.CAL.TEXT1', 'HELP.CAL.TEXT2']},
                    {q: 'HELP.SHARE.CAL', a: ['HELP.SHARE.CAL.TEXT1', 'HELP.SHARE.CAL.TEXT2', 'HELP.SHARE.CAL.TEXT3']},
                    {q: 'HELP.SHARE.EVENT', a: ['HELP.SHARE.EVENT.TEXT1', 'HELP.SHARE.EVENT.TEXT2']},
                    {q: 'HELP.IMPORT.EVENT', a: ['HELP.IMPORT.EVENT.TEXT1', 'HELP.IMPORT.EVENT.TEXT2', 'HELP.IMPORT.EVENT.TEXT3']},
                    {q: 'HELP.WWW', a: ['HELP.WWW.TEXT1', 'HELP.WWW.TEXT2', 'HELP.WWW.TEXT3', 'HELP.WWW.TEXT4', 'HELP.WWW.TEXT5']},
                    {q: 'HELP.CLEANUP', a: ['HELP.CLEANUP.TEXT']},
                    {q: 'HELP.THUMB', a: ['HELP.THUMB.TEXT']},
                    {q: 'HELP.FEEDBACK', a: ['HELP.FEEDBACK.TEXT']},
                    {q: 'HELP.PASSWORD', a: ['HELP.PASSWORD.TEXT']},
                    {q: 'HELP.DELETE', a: ['HELP.DELETE.TEXT1', 'HELP.DELETE.TEXT2']},
                ]},
                {title: 'HELP.GRIPES', suffix: ':', items: [
                    {q: 'HELP.SLOW', a: ['HELP.SLOW.TEXT1', 'HELP.SLOW.TEXT2']},
                    {q: 'HELP.JAVA', a: ['HELP.JAVA.TEXT1', 'HELP.JAVA.TEXT2']},
                ]},
            ],
            // answers that end in a link, written out after the translated text
            links: {
                'HELP.WWW.TEXT5': 'https://peergos.org/posts/p2p-web-hosting',
            },
        }
    },
}
</script>
<style>
.help-link:link {
    text-decoration: underline;
}

/* questions that open in place to show their answer, grouped under a heading */
.help__section {
	display: flex;
	flex-direction: column;
}

.help__heading {
	margin: 4px 0 6px;
	font-size: 13px;
	font-weight: var(--regular);
	text-transform: uppercase;
	letter-spacing: .07em;
	color: var(--pg-muted);
}

.help__item {
	border-bottom: 1px solid var(--pg-track);
}

.help__item summary {
	padding: 12px 4px;
	font-weight: var(--bold);
	cursor: pointer;
}

.help__item summary:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

.help__answer {
	padding: 0 4px 12px;
}

.help__answer p {
	margin: 0 0 8px;
}
</style>
