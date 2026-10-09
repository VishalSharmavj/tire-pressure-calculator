/** DOM wiring. The only file here that knows a browser exists. */
import { pressures, toBar } from './pressure.js';
import { validate, advise } from './advice.js';

const $ = (id) => document.getElementById(id);
const num = (id) => parseFloat($(id).value);

function readForm() {
	return {
		riderKg: num('rider'), bikeKg: num('bike'), gearKg: num('gear') || 0,
		split: (num('split') || 45) / 100,
		widthFront: num('wf'), widthRear: num('wr'),
		iso: num('iso'),
		surface: $('surface').value, style: $('style').value,
		setup: $('setup').value, casing: $('casing').value,
		ebike: $('ebike').checked, hookless: $('hookless').checked,
		maxPsi: parseFloat($('maxpsi').value) || 0
	};
}

/* Below 15 psi a tenth matters; above it nobody can set one.
 *
 * `exact` is for a capped figure. A safety limit must never be rounded UP:
 * showing the 72.5 psi hookless limit as "73" tells the reader to inflate
 * past the very limit being enforced. */
const show = (psi, unit, exact = false) => {
	if (unit === 'bar') return toBar(psi).toFixed(2);
	if (exact) return psi.toFixed(psi % 1 === 0 ? 0 : 1);
	return psi.toFixed(psi < 15 ? 1 : 0);
};

function render() {
	const spec = readForm();
	const problems = validate(spec);
	const unit = $('unit').value;

	$('problems').hidden = problems.length === 0;
	$('problems').innerHTML = problems.map((p) => `<li>${esc(p)}</li>`).join('');

	if (problems.length) {
		for (const s of ['front', 'rear']) {
			$(`psi-${s}`).textContent = '—';
			$(`alt-${s}`).textContent = '';
			$(`meta-${s}`).innerHTML = '';
			$(`card-${s}`).classList.add('is-empty');
		}
		for (const id of ['stat-total', 'stat-lf', 'stat-lr', 'stat-drop']) $(id).textContent = '—';
		$('warnings').hidden = true;
		return;
	}

	const r = pressures(spec);

	for (const side of ['front', 'rear']) {
		const w = r[side];
		$(`card-${side}`).classList.remove('is-empty');
		$(`u-${side}`).textContent = unit;
		$(`psi-${side}`).innerHTML = show(w.psi, unit, Boolean(w.cappedFrom))
			+ (w.cappedFrom ? '<span class="capped">at limit</span>' : '');
		$(`alt-${side}`).textContent = unit === 'bar'
			? `${w.psi.toFixed(0)} psi`
			: `${toBar(w.psi).toFixed(2)} bar`;
		$(`meta-${side}`).innerHTML = [
			`<li>${side === 'front' ? spec.widthFront : spec.widthRear} mm</li>`,
			`<li>${(w.drop * 100).toFixed(1)}% drop</li>`
		].join('');
	}

	$('stat-total').textContent = `${r.totalKg.toFixed(1)} kg`;
	$('stat-lf').textContent = `${(r.totalKg * spec.split).toFixed(1)} kg`;
	$('stat-lr').textContent = `${(r.totalKg * (1 - spec.split)).toFixed(1)} kg`;
	$('stat-drop').textContent = `${(r.front.drop * 100).toFixed(1)}%`;

	const notes = advise(spec, r);
	$('warnings').hidden = notes.length === 0;
	$('warnings').innerHTML = notes
		.map((n) => `<li class="is-${n.level}">${esc(n.text)}</li>`).join('');
}

function esc(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

$('form').addEventListener('input', render);
$('form').addEventListener('change', render);
$('form').addEventListener('submit', (e) => e.preventDefault());
render();
