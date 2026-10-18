// The paid plans, as sign up, mirror and the upgrade dialog offer them: what each holds, and its price a month,
// billed monthly or yearly.
const PLANS = [
	{name: "Pro", gb: 200, bytes: 200000000000, monthly: 4, yearly: 3},
	{name: "Visionary", gb: 1000, bytes: 1000000000000, monthly: 10, yearly: 8},
	{name: "Pioneer", gb: 3000, bytes: 3000000000000, monthly: 25, yearly: 20},
];

module.exports = {
	data() {
		return {
			plans: PLANS,
		};
	},
	methods: {
		planPrice(plan, annual) {
			return (annual ? plan.yearly : plan.monthly) + " / " + this.translate("SIGNUP.MONTH") + ", "
				+ (annual ? this.translate("SIGNUP.BILL.YEARLY") : this.translate("SIGNUP.BILL.MONTHLY"));
		},
	},
};
