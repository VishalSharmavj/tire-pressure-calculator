/**
 * Bicycle tyre pressure.
 *
 * Pure functions. No DOM, no dependencies — the same file runs in a browser,
 * in Node and in the test suite.
 *
 * The model is a tyre-drop one. "Tyre drop" is how far the tyre squashes under
 * load as a fraction of its height, and the useful insight is that the right
 * drop is roughly CONSTANT — about 15% — across tyre widths and rider weights.
 * Hold the drop constant and the pressure falls out:
 *
 *     P = reference(width) x (load / 45) x wheelSize x surface x style x setup x casing
 *
 * where reference(width) is the pressure a tyre of that measured width needs to
 * carry 45 kg on one wheel at ~15% drop, on smooth tarmac, tubeless, standard
 * casing, 700c.
 */

export const PSI_PER_BAR = 14.5038;

/**
 * psi at 45 kg on the wheel: tubeless, standard casing, smooth tarmac, 700c.
 *
 * Width is the tyre's MEASURED width on your rim, not the number printed on
 * the sidewall. A 25 mm tyre on a modern wide rim measures 28 mm, and that is
 * a 13 psi difference — far more than most people's guesswork.
 */
export const BASE = [
	[20, 118], [23, 101], [25, 91], [28, 78], [32, 65], [35, 57], [38, 50],
	[40, 47], [45, 40], [50, 35], [55, 32], [60, 29], [65, 26.5], [70, 24.5],
	[75, 23], [80, 21], [90, 17.8], [100, 15.2], [110, 13.1], [120, 11.5], [130, 10.4]
];

/**
 * Rougher ground wants less pressure. Past a point the tyre stops rolling over
 * the bumps and starts lifting the whole bike over them, which costs far more
 * than the rolling resistance you save by running hard.
 *
 * Hitting things hard pushes the other way — that is STYLE's job, not this.
 */
export const SURFACE = {
	velodrome: 1.20, newTarmac: 1.04, tarmac: 1.00, poorTarmac: 0.93, cobbles: 0.86,
	hardpack: 0.90, smoothGravel: 0.85, looseGravel: 0.80,
	singletrack: 0.76, rockGardens: 0.72, soft: 0.52
};

/** How hard you hit things. Protecting the rim costs comfort and grip. */
export const STYLE = { steady: 0.94, normal: 1.00, fast: 1.07, race: 1.10 };

/** What is inside the tyre. A tube pinches, so it needs more air to stay safe. */
export const SETUP = { tubeless: 1.00, insert: 0.95, latex: 1.04, tube: 1.07, tubular: 0.98 };

/** How stiff the casing is. A supple casing holds its shape with less air. */
export const CASING = { supple: 1.05, standard: 1.00, reinforced: 0.96, dh: 0.94 };

/** ETRTO's limit for hookless rims. Not advisory — the tyre can blow off. */
export const HOOKLESS_LIMIT_PSI = 72.5;

/**
 * Interpolate the reference curve.
 *
 * Straight line through log(width)/log(psi), because each segment of the curve
 * is close to a power law. That keeps it smooth through the middle and makes
 * it extrapolate sanely off both ends, instead of running to zero or infinity
 * the way a linear fit does.
 */
export function basePsi(width) {
	if (!(width > 0)) return 0;
	const t = BASE;
	let i;
	if (width <= t[0][0]) i = 0;
	else if (width >= t[t.length - 1][0]) i = t.length - 2;
	else { for (i = 0; i < t.length - 2 && width > t[i + 1][0]; i++); }

	const x0 = Math.log(t[i][0]), y0 = Math.log(t[i][1]);
	const x1 = Math.log(t[i + 1][0]), y1 = Math.log(t[i + 1][1]);
	return Math.exp(y0 + (Math.log(width) - x0) * ((y1 - y0) / (x1 - x0)));
}

/**
 * Pressure for one wheel.
 *
 * @param {object} o
 * @param {number} o.width     measured tyre width, mm
 * @param {number} o.load      weight on THIS wheel, kg
 * @param {number} [o.iso=622] rim bead seat diameter, mm
 * @param {string} [o.surface] key of SURFACE
 * @param {string} [o.style]   key of STYLE
 * @param {string} [o.setup]   key of SETUP
 * @param {string} [o.casing]  key of CASING
 * @param {boolean} [o.ebike]  heavier, more torque, wants a little more air
 */
export function wheelPressure(o) {
	const width = o.width;
	if (!(width > 0) || !(o.load > 0)) return { psi: 0, reference: 0, drop: 0 };

	const reference = basePsi(width) * (o.load / 45);

	/* A smaller wheel lays down a shorter contact patch, so it needs slightly
	   more air for the same tyre drop. Patch length goes with the square root
	   of the rolling radius. */
	const iso = o.iso || 622;
	const rRef = 622 / 2 + width;
	const rAct = iso / 2 + width;
	const sizeK = rAct > 0 ? Math.sqrt(rRef / rAct) : 1;

	let psi = reference * sizeK
		* (SURFACE[o.surface] ?? 1)
		* (STYLE[o.style] ?? 1)
		* (SETUP[o.setup] ?? 1)
		* (CASING[o.casing] ?? 1);

	if (o.ebike) psi *= 1.05;

	return {
		psi,
		reference: reference * sizeK,
		/* The reference curve is the ~15% drop figure, so running below it
		   drops proportionally further. */
		drop: psi > 0 ? (0.15 * reference * sizeK) / psi : 0
	};
}

/**
 * Both wheels, with the weight split between them.
 *
 * `split` is the fraction on the FRONT wheel. 0.45 is a sensible default for
 * an upright position; a low road position moves towards 0.48, a long-travel
 * mountain bike descending towards 0.40.
 */
export function pressures(spec) {
	const total = (spec.riderKg || 0) + (spec.bikeKg || 0) + (spec.gearKg || 0);
	const split = spec.split ?? 0.45;
	const common = {
		iso: spec.iso, surface: spec.surface, style: spec.style,
		setup: spec.setup, casing: spec.casing, ebike: spec.ebike
	};

	const front = wheelPressure({ ...common, width: spec.widthFront, load: total * split });
	const rear = wheelPressure({ ...common, width: spec.widthRear, load: total * (1 - split) });

	let ceiling = spec.hookless ? HOOKLESS_LIMIT_PSI : 0;
	if (spec.maxPsi > 0) ceiling = ceiling > 0 ? Math.min(ceiling, spec.maxPsi) : spec.maxPsi;

	return {
		totalKg: total,
		front: capped(front, ceiling),
		rear: capped(rear, ceiling),
		ceiling
	};
}

function capped(w, ceiling) {
	if (ceiling > 0 && w.psi > ceiling) {
		return { ...w, psi: ceiling, cappedFrom: w.psi };
	}
	return w;
}

export const toBar = (psi) => psi / PSI_PER_BAR;
export const fromBar = (bar) => bar * PSI_PER_BAR;
