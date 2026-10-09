import test from 'node:test';
import assert from 'node:assert/strict';
import {
	basePsi, wheelPressure, pressures, toBar, fromBar,
	BASE, SURFACE, HOOKLESS_LIMIT_PSI
} from '../js/pressure.js';
import { validate, advise } from '../js/advice.js';

const near = (a, b, tol = 0.1) =>
	assert.ok(Math.abs(a - b) < tol, `expected ${a} to be within ${tol} of ${b}`);

const ROAD = {
	riderKg: 75, bikeKg: 9, gearKg: 1, split: 0.45,
	widthFront: 28, widthRear: 28, iso: 622,
	surface: 'tarmac', style: 'normal', setup: 'tubeless', casing: 'standard'
};

test('basePsi: hits the table exactly at its own points', () => {
	for (const [w, psi] of BASE) near(basePsi(w), psi, 1e-9);
});

test('basePsi: falls monotonically — wider always means less air', () => {
	let last = Infinity;
	for (let w = 18; w <= 135; w += 0.5) {
		const p = basePsi(w);
		assert.ok(p < last, `pressure rose between ${w - 0.5} and ${w} mm`);
		last = p;
	}
});

test('basePsi: extrapolates sanely off both ends', () => {
	/* A linear fit runs to zero or negative off the wide end. Log-log cannot. */
	assert.ok(basePsi(150) > 0);
	assert.ok(basePsi(150) < basePsi(130));
	assert.ok(basePsi(15) > basePsi(20));
	assert.ok(isFinite(basePsi(200)));
});

test('basePsi: the sidewall-vs-measured gap is worth about 13 psi', () => {
	/* A 25 mm tyre measuring 28 mm on a wide rim. This is the single biggest
	   source of error in tyre pressure, and it is pure measurement. */
	near(basePsi(25) - basePsi(28), 13, 0.5);
});

test('wheelPressure: known good values for a road wheel', () => {
	const r = pressures(ROAD);
	near(r.front.psi, 66.3);
	near(r.rear.psi, 81.0);
});

test('wheelPressure: known good values for a trail bike', () => {
	const r = pressures({
		riderKg: 75, bikeKg: 14, gearKg: 2, split: 0.45,
		widthFront: 61, widthRear: 61, iso: 622,
		surface: 'singletrack', style: 'normal', setup: 'tubeless', casing: 'reinforced'
	});
	near(r.front.psi, 18.9);
	near(r.rear.psi, 23.1);
});

test('pressures: the rear always wants more, because it carries more', () => {
	const r = pressures(ROAD);
	assert.ok(r.rear.psi > r.front.psi);
	/* Same tyre, same everything — the only difference is the load split. */
	near(r.rear.psi / r.front.psi, 0.55 / 0.45, 0.01);
});

test('pressures: heavier rider, more air, in proportion', () => {
	const light = pressures({ ...ROAD, riderKg: 60 });
	const heavy = pressures({ ...ROAD, riderKg: 90 });
	assert.ok(heavy.front.psi > light.front.psi);
	/* Load scaling is linear, so the ratio of pressures matches the ratio of
	   total weights. */
	near(heavy.front.psi / light.front.psi, (90 + 10) / (60 + 10), 0.01);
});

test('pressures: rougher ground wants less air', () => {
	const order = ['velodrome', 'tarmac', 'smoothGravel', 'singletrack', 'soft'];
	let last = Infinity;
	for (const surface of order) {
		const p = pressures({ ...ROAD, surface }).front.psi;
		assert.ok(p < last, `${surface} should be softer than the one before`);
		last = p;
	}
});

test('pressures: a smaller wheel needs slightly more air', () => {
	/* Shorter contact patch for the same drop. */
	const big = pressures({ ...ROAD, iso: 622 }).front.psi;
	const small = pressures({ ...ROAD, iso: 406 }).front.psi;
	assert.ok(small > big);
	near(small / big, Math.sqrt((622 / 2 + 28) / (406 / 2 + 28)), 0.001);
});

test('pressures: the hookless limit is a cap, not a suggestion', () => {
	/* A heavy rider on narrow tyres wants more than hookless rims allow. */
	const r = pressures({ ...ROAD, riderKg: 95, widthFront: 23, widthRear: 23, hookless: true });
	assert.equal(r.rear.psi, HOOKLESS_LIMIT_PSI);
	assert.ok(r.rear.cappedFrom > HOOKLESS_LIMIT_PSI);
	assert.match(advise({ ...ROAD, riderKg: 95, widthFront: 23, widthRear: 23, hookless: true }, r)
		.map((n) => n.text).join(' '), /blow off/);
});

test('pressures: a sidewall maximum caps it too, and the lower one wins', () => {
	const spec = { ...ROAD, riderKg: 95, widthFront: 23, widthRear: 23, hookless: true, maxPsi: 60 };
	const r = pressures(spec);
	assert.equal(r.rear.psi, 60);
});

test('tyre drop sits near 15% at the reference condition', () => {
	/* The whole model is built on holding drop roughly constant, so the
	   reference case had better land where it claims to. */
	const r = pressures(ROAD);
	near(r.front.drop * 100, 15, 0.01);
});

test('bar and psi convert back cleanly', () => {
	near(fromBar(toBar(66.3)), 66.3, 1e-9);
	near(toBar(14.5038), 1, 1e-6);
});

test('validate: catches inch widths entered as millimetres', () => {
	const problems = validate({ ...ROAD, widthFront: 2.4 });
	assert.match(problems.join(' '), /2\.4 inch tyre is 61 mm/);
});

test('validate: accepts a sound spec', () => {
	assert.deepEqual(validate(ROAD), []);
});

test('advise: flags a supple casing on an e-bike', () => {
	const spec = { ...ROAD, ebike: true, casing: 'supple' };
	assert.match(advise(spec, pressures(spec)).map((n) => n.text).join(' '), /wears fast/);
});

test('advise: stays quiet about an ordinary road setup', () => {
	const spec = { ...ROAD, split: 0.5, widthFront: 32, widthRear: 32 };
	const notes = advise(spec, pressures(spec)).filter((n) => n.level === 'bad');
	assert.deepEqual(notes, []);
});

test('a capped pressure is never displayed rounded UP past its own limit', () => {
	/* Formatting bug with real consequences: 72.5 shown as "73" tells the
	   reader to inflate past the limit being enforced. The display rule for a
	   capped figure must keep the decimal. */
	const show = (psi, exact) => exact
		? psi.toFixed(psi % 1 === 0 ? 0 : 1)
		: psi.toFixed(psi < 15 ? 1 : 0);

	assert.equal(show(HOOKLESS_LIMIT_PSI, true), '72.5');
	assert.ok(parseFloat(show(HOOKLESS_LIMIT_PSI, true)) <= HOOKLESS_LIMIT_PSI);
	assert.equal(show(60, true), '60');          // whole numbers stay whole
});
