# Tyre Pressure Calculator

Front and rear tyre pressure from your weight, your measured tyre width and
what you are riding on. Road, gravel, mountain bike, fat and e-bike.

No dependencies, no build step, no framework.

**[Try the full version on Bikeshala →](https://bikeshala.com/tools/tire-pressure-calculator/)**

```
75 kg rider · 9 kg bike · 700 x 28 tubeless · normal tarmac

Front               Rear
66 psi              81 psi
4.57 bar            5.59 bar
15.0% drop          15.0% drop
```

---

## Run it

```bash
git clone https://github.com/VishalSharmavj/tire-pressure-calculator.git
cd tire-pressure-calculator
python3 -m http.server 8000     # or: npm start
```

Then open <http://localhost:8000>.

```bash
npm test        # 18 tests, no dependencies
```

---

## Use the maths on its own

`js/pressure.js` imports nothing:

```js
import { pressures, basePsi } from './js/pressure.js';

const r = pressures({
  riderKg: 75, bikeKg: 9, gearKg: 1,
  split: 0.45,                  // fraction of weight on the front wheel
  widthFront: 28, widthRear: 28, // MEASURED width, mm
  iso: 622,
  surface: 'tarmac', style: 'normal', setup: 'tubeless', casing: 'standard'
});

r.front.psi;    // 66.3
r.rear.psi;     // 81.0
r.front.drop;   // 0.15  — tyre drop as a fraction of tyre height
```

---

## How it works

### Tyre drop, not pressure, is the thing being held constant

The insight the whole model rests on: the *right* amount for a tyre to squash
under load — its **tyre drop** — is roughly **constant at about 15%**, across
widths and across rider weights. Too little and the tyre skips over bumps
instead of absorbing them; too much and it squirms, rolls badly and risks the
rim.

So the model fixes the drop and solves for the pressure that produces it:

```
P = reference(width) × (load / 45) × wheelSize × surface × style × setup × casing
```

`reference(width)` is the pressure a tyre of that width needs to carry 45 kg on
one wheel at ~15% drop, tubeless, standard casing, smooth tarmac, 700c. A test
asserts the reference case really does land at 15.0%, so the curve and the
claim cannot drift apart.

### Why the curve is interpolated in log-log

```js
Math.exp(y0 + (Math.log(w) - x0) * ((y1 - y0) / (x1 - x0)))
```

Each segment of the width/pressure relationship is close to a power law, so a
straight line through `log(width)` against `log(psi)` stays smooth through the
middle **and extrapolates sanely off both ends**. A linear fit runs to zero —
and then negative — somewhere past the wide end of the table. Tests pin both:
the curve is monotonic across 18–135 mm, and still positive at 150 mm.

### Measured width is the input, and it is where the errors are

A tyre marked 25 mm measures 28 mm on a modern wide rim. That is **13 psi** of
difference:

```js
basePsi(25) - basePsi(28);   // ≈ 13
```

Bigger than any other single error in the process, and bigger than most
people's guesswork. Measure the tyre on your own rim with calipers, inflated.
There is a test on that 13 psi gap, because it is the number that justifies the
whole instruction.

### Front and rear are different because the weight is

The rear carries more, so it wants more air. With a 45/55 split the pressures
land in exactly that ratio:

```js
r.rear.psi / r.front.psi === 0.55 / 0.45
```

Running both tyres the same is choosing to have one of them wrong.

### Smaller wheels want slightly more

A smaller wheel lays down a shorter contact patch for the same drop, and patch
length goes with the square root of rolling radius:

```js
sizeK = Math.sqrt((622/2 + width) / (iso/2 + width))
```

### The hookless limit is a cap, not advice

```js
HOOKLESS_LIMIT_PSI  // 72.5
```

ETRTO's limit for hookless rims. Above it the tyre can come off the rim, which
at road speed is not a flat tyre — it is a crash. When the model wants more
than the limit, the tool returns the limit, flags that it did, and tells you to
fit a wider tyre instead of going over.

A sidewall maximum caps it too, and if both apply the lower one wins.

### Modifiers

| | |
|---|---|
| **surface** | Rougher ground wants less. Past a point the tyre stops rolling over bumps and starts lifting the bike over them, which costs far more than the rolling resistance saved. |
| **style** | How hard you hit things. This is the one that pushes *up*. |
| **setup** | A tube pinches, so it needs more air. An insert protects the rim, so it needs less. |
| **casing** | A supple casing holds its shape with less air; a stiff downhill casing does some of the work itself. |

---

## Layout

```
index.html            the UI
css/base.css          tokens, layout, inputs
css/calculator.css    result cards, stats, warnings
js/pressure.js        the model — pure functions, no DOM, no imports
js/advice.js          validation and the safety warnings
js/app.js             the only file that knows a browser exists
test/pressure.test.js 18 tests, node --test
```

---

## Accuracy

Produces identical results to the full Bikeshala calculator — verified to
within 10⁻¹⁴ psi across road, trail, gravel, e-bike, fat and track builds.

Treat the output as a **starting point**, not a final answer. Ride it, then
adjust by a couple of psi at a time towards whatever feels better. Nobody's
model knows your tyres, your roads or your hands.

---

## What this version leaves out

A deliberately simplified build. The full version on Bikeshala also:

- **compensates for temperature** — inflate in a warm shed, ride somewhere cold
  and the pressure drops with it
- **draws the tyre** so you can see what 15% drop actually looks like
- carries **bike presets** for road, gravel, trail, e-MTB and touring
- works out **measured width from your rim width** when you have no calipers

**[Tyre Pressure Calculator on Bikeshala →](https://bikeshala.com/tools/tire-pressure-calculator/)**

---

## Licence

MIT — see [LICENSE](LICENSE).
