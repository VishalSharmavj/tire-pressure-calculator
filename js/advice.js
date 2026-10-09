/**
 * Sanity checks and advice on a calculated pressure. Pure functions.
 *
 * These are the things that are worth saying out loud because getting them
 * wrong damages something — a rim, a tyre, or a collarbone.
 */
import { HOOKLESS_LIMIT_PSI } from './pressure.js';

export function validate(spec) {
	const problems = [];
	const rider = spec.riderKg;

	if (!(rider > 0)) problems.push('Enter your weight.');
	else if (rider < 20 || rider > 200) problems.push(`A rider weight of ${rider} kg is outside what this model covers (20–200 kg).`);

	for (const [name, w] of [['front', spec.widthFront], ['rear', spec.widthRear]]) {
		if (!(w > 0)) problems.push(`Enter the ${name} tyre width.`);
		else if (w < 15 || w > 140) problems.push(`A ${name} tyre of ${w} mm is outside the range of bicycle tyres (15–140 mm). Widths are millimetres — a 2.4 inch tyre is 61 mm.`);
	}

	if (spec.split <= 0 || spec.split >= 1) problems.push('The weight split on the front must be between 0 and 100%.');
	return problems;
}

/**
 * Advisory notes. These never suppress the answer — the number is sound, there
 * is just something about it worth knowing.
 */
export function advise(spec, result) {
	const notes = [];

	if (result.ceiling > 0 && (result.front.cappedFrom || result.rear.cappedFrom)) {
		const limit = spec.hookless && result.ceiling === HOOKLESS_LIMIT_PSI
			? `the ${HOOKLESS_LIMIT_PSI} psi hookless limit`
			: `your ${result.ceiling} psi sidewall maximum`;
		notes.push({
			level: 'bad',
			text: `The model wants more than ${limit}, so the figure shown is the limit, not the ideal. `
				+ 'Fit a wider tyre rather than going over it — on a hookless rim the tyre can blow off.'
		});
	}

	if (spec.hookless && !result.front.cappedFrom && result.front.psi > HOOKLESS_LIMIT_PSI * 0.9) {
		notes.push({ level: 'warn', text: `That is close to the ${HOOKLESS_LIMIT_PSI} psi hookless limit. Check with a gauge you trust, not a track pump's dial.` });
	}

	if (result.front.psi > 0 && result.front.psi < 15 && spec.setup === 'tube') {
		notes.push({ level: 'warn', text: 'Below about 15 psi an inner tube pinch-flats easily. Tubeless, or an insert, makes this pressure practical.' });
	}

	if (spec.ebike && spec.casing === 'supple') {
		notes.push({ level: 'warn', text: 'A supple race casing under an e-bike wears fast and cuts easily. The extra weight and torque want a reinforced casing.' });
	}

	if (result.front.psi > 100) {
		notes.push({ level: 'warn', text: 'Over 100 psi is more than almost any modern tyre needs. Check you entered the tyre\'s MEASURED width rather than a narrower printed one.' });
	}

	return notes;
}
