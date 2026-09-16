/* ==========================================================================
   PRICESHOCK — game logic
   --------------------------------------------------------------------------
   Depends on data.js (CATEGORIES, ROUNDS) being loaded first.

   Shape of a session:
     pickCategory -> 10 shuffled rounds -> reveal per round -> results screen

   The reveal is the whole product, so it is deliberately staged rather than
   instant: cards lock, prices count up from zero at different rates so they
   finish together, then the multiplier slams in. Rushing this kills the joke.
   ========================================================================== */

(function () {
  "use strict";

  var ROUND_COUNT = 10;
  var COUNT_MS = 650;           // fast enough to keep the loop hot; click skips it
  var SHOCK_RATIO = 3;          // at or above this, it's a "PRICE SHOCK"

  // Scoring. A correct answer is worth BASE; each consecutive correct answer
  // after the first adds STREAK_STEP, up to STREAK_CAP in a row. So 1st 100,
  // 2nd 150, 3rd 200, 4th 250, 5th and beyond 300. Rounds 5 and 10 pay
  // double, so a perfect run is 3,100.
  // Rank still keys off the correct COUNT, not points, so the existing rank
  // copy stays true and a lucky streak cannot buy a better title.
  var BASE_POINTS = 100;
  var STREAK_STEP = 50;
  var STREAK_CAP = 5;
  var STORAGE_KEY = "priceshock-records-v1";

  var el = {
    screens: {
      title: document.getElementById("screen-title"),
      game: document.getElementById("screen-game"),
      end: document.getElementById("screen-end"),
    },
    cardA: document.getElementById("card-a"),
    cardB: document.getElementById("card-b"),
    flash: document.getElementById("flash"),
    round: document.getElementById("hud-round"),
    progress: document.getElementById("progress-fill"),
    score: document.getElementById("hud-score"),
    hudBest: document.getElementById("hud-best"),
    hudBestWrap: document.getElementById("hud-best-wrap"),
    hudNext: document.getElementById("hud-next"),
    roundPrompt: document.getElementById("round-prompt"),
    streak: document.getElementById("hud-streak"),
    heatSteps: document.querySelectorAll("[data-heat]"),
    verdict: document.getElementById("verdict"),
    vTag: document.getElementById("verdict-tag"),
    vMult: document.getElementById("verdict-multiplier"),
    vLine: document.getElementById("verdict-line"),
    vFact: document.getElementById("verdict-fact"),
    award: document.getElementById("verdict-award"),
    awardNote: document.getElementById("verdict-award-note"),
    btnNext: document.getElementById("btn-next"),
    btnBack: document.getElementById("btn-back"),
    btnAgain: document.getElementById("btn-again"),
    btnCategories: document.getElementById("btn-categories"),
    endScore: document.getElementById("end-score"),
    endRank: document.getElementById("end-rank"),
    endBlurb: document.getElementById("end-blurb"),
    endWorst: document.getElementById("end-worst"),
    endEyebrow: document.getElementById("end-eyebrow"),
    endTally: document.getElementById("end-tally"),
    titleBest: document.getElementById("title-best"),
    titleBestNote: document.getElementById("title-best-note"),
    endRecord: document.getElementById("end-record"),
    endRecordLabel: document.getElementById("end-record-label"),
    endBest: document.getElementById("end-best"),
    endRecordNote: document.getElementById("end-record-note"),
    live: document.getElementById("live-status"),
  };

  var state = {
    categoryId: null,
    rounds: [],
    index: 0,
    score: 0,
    points: 0,
    streak: 0,
    bestStreak: 0,
    locked: false,
    biggestShock: null,
    recordAtStart: 0,
  };

  function loadRecords() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        best: Number(parsed.best) || 0,
        runs: Number(parsed.runs) || 0,
        bestByCategory: parsed.bestByCategory || {},
      };
    } catch (err) {
      return { best: 0, runs: 0, bestByCategory: {} };
    }
  }

  var records = loadRecords();

  function saveRecords() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
    catch (err) { /* Private browsing can deny storage; the game still works. */ }
  }

  function updateRecordDisplays() {
    var formatted = records.best.toLocaleString("en-US");
    el.titleBest.textContent = formatted;
    el.hudBest.textContent = formatted;
    el.endBest.textContent = formatted;
    el.titleBestNote.textContent = records.runs
      ? records.runs + (records.runs === 1 ? " run played" : " runs played")
      : "Set the first record";
  }

  /* ---------------------------------------------------------- utilities */

  function shuffle(arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* Cents, but only where they are the point. Every item in the first five
     categories is a whole number of dollars, and rounding kept the reveal
     uncluttered. Food is different: a Costco rotisserie chicken is famous for
     being $4.99, not $5, and a Big Mac shown as $6 is not the price anybody has
     ever paid. So an exact call prints the cents when the figure actually has
     any, and every existing whole-dollar item is untouched.

     `exact` is off by default because countUp() calls this on every frame with
     a fractional intermediate value — printing cents there would spin two
     jittering decimal places through the whole animation. Only the settled
     figure asks for them. */
  function money(n, exact) {
    if (exact && n % 1 !== 0) {
      return "$" + n.toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    }
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  // Reads nicer than a raw multiplier once the gap gets silly.
  function formatMultiplier(ratio) {
    if (ratio >= 100) return Math.round(ratio) + "×";
    if (ratio >= 10) return ratio.toFixed(0) + "×";
    return ratio.toFixed(1).replace(/\.0$/, "") + "×";
  }

  // Swapping screens is a navigation, so focus has to go with it. Without this,
  // pressing "See results" hides the button that had focus and drops the
  // keyboard caret back to <body> — the results never get announced and the
  // next Tab starts from the top of the document. Each screen carries
  // tabindex="-1" so it can receive focus without entering the tab order.
  function showScreen(name) {
    Object.keys(el.screens).forEach(function (k) {
      el.screens[k].classList.toggle("is-active", k === name);
    });
    window.scrollTo({ top: 0, behavior: "auto" });

    // Back to house colours on the title screen. startCategory() pins --accent
    // to whichever category is being played, and without this the page kept
    // that tint after "Pick another category" — so the grid of six differently
    // coloured cards sat inside, say, a green Launch Prices wash, which reads
    // as though a category were still selected. Clearing the inline values
    // lets :root's own defaults take over again.
    if (name === "title") {
      document.documentElement.style.removeProperty("--accent");
      document.documentElement.style.removeProperty("--accent-2");
    }

    var active = el.screens[name];
    if (active && typeof active.focus === "function") active.focus();
  }

  /* ------------------------------------------------------------- render */

  function cardMarkup(item, key, arrow) {
    return (
      '<span class="card-pick">your pick</span>' +
      '<span class="card-key" aria-hidden="true">' + arrow + " " + key + "</span>" +
      orbMarkup(item) +
      '<span class="card-body">' +
        '<span class="card-brand">' + item.brand + "</span>" +
        '<span class="card-name">' + item.name + "</span>" +
      "</span>" +
      // Price and note are wrapped together so the reveal block stays one
      // layout unit. Kept as siblings they overlapped the name on narrow
      // screens once a product name wrapped to three lines.
      '<span class="card-figures">' +
        '<span class="card-price" data-price></span>' +
        '<span class="card-note"></span>' +
      "</span>"
    );
  }

  function renderRound() {
    var round = state.rounds[state.index];
    var roundNumber = state.index + 1;
    var doubleDrop = roundNumber === 5 || roundNumber === 10;

    [el.cardA, el.cardB].forEach(function (card) {
      card.className = "card";
      card.disabled = false;
    });

    el.cardA.innerHTML = cardMarkup(round.left, "A", "←");
    el.cardB.innerHTML = cardMarkup(round.right, "B", "→");
    el.cardA.setAttribute("aria-label", "Choose " + round.left.brand + " " + round.left.name);
    el.cardB.setAttribute("aria-label", "Choose " + round.right.brand + " " + round.right.name);

    el.verdict.hidden = true;
    el.round.textContent = "Round " + (state.index + 1) + " / " + ROUND_COUNT;
    el.progress.style.width = (state.index / ROUND_COUNT) * 100 + "%";
    el.roundPrompt.innerHTML = doubleDrop
      ? '<span class="double-drop">Double drop</span> Which costs <em>more</em>?'
      : 'Which costs <em>more</em>?';
    el.screens.game.classList.toggle("is-double", doubleDrop);
    updateHeat();
    state.locked = false;

    // Hiding the verdict destroys the focus that was on its Next button, so
    // without this a keyboard user landed back on <body> at the start of
    // every round and had to tab in again. Focus the left card: its
    // aria-label was just rewritten to "Choose <brand> <name>", so it states
    // both what this control does and what is on offer.
    //
    // Together with the move to Next in settle(), this closes the loop —
    // category, card, next, card, next — with focus never dropped. Both
    // moves only ever reclaim focus from an element that is being disabled
    // or hidden; neither takes it from something the user could still use.
    el.cardA.focus();
  }

  /* ------------------------------------------------------------- reveal */

  // Counts an element from 0 to `target`. Both cards are given the same
  // duration so the cheaper one doesn't finish first and spoil the reveal.
  // Item art. Every item already carries an emoji, so the emoji is the key —
  // a new item gets art for free, and nothing has to be edited into data.js.
  // Items map to the NEAREST symbol, not an exact one: a Submariner and a
  // Speedmaster are both `watch`, a 911 and a Camry are both `car`.
  var ART = {
    "⌚": "watch", "🏎️": "supercar", "🚗": "car", "🚙": "car",
    "👟": "sneaker", "🥾": "boot", "🩴": "sandal", "👞": "dressShoe",
    "👜": "handbag", "👛": "handbag", "🧳": "luggage",
    "🧥": "coat", "🧣": "scarf", "👕": "tshirt", "👔": "shirt", "👖": "jeans",
    "🕶️": "sunglasses", "💍": "ring", "💎": "gem", "💛": "bracelet",
    "🍾": "bottle", "💨": "styler",
    "📱": "phone", "📟": "phone", "💻": "laptop", "🖥️": "desktop",
    "⌨️": "keyboard", "📺": "tv", "🎮": "controller", "🕹️": "controller",
    "🥽": "vr", "📝": "pda", "🖋️": "pen", "🎵": "musicPlayer",
    "🛵": "scooter", "🛴": "scooter", "🚲": "bicycle",
    // Food deliberately collapses to three symbols rather than seventeen. The
    // art is a fallback for a photograph that failed to load, and a plate that
    // honestly says "some food" is better than a drawn ribeye that will never
    // be seen — every catalogue item ships a local photograph. Drinks split out
    // because a cup and a jug are the two that would look wrong as a plate.
    "🍗": "plate", "🥚": "plate", "🌾": "plate", "🍔": "plate", "🍜": "plate",
    "🌱": "plate", "🍫": "plate", "🍈": "plate", "🍕": "plate", "🥄": "plate",
    "🥩": "plate", "🍄": "plate", "🍖": "plate",
    "☕": "cup", "🥛": "jug", "💧": "jug", "🥃": "bottle",
  };

  function artFor(item) {
    return ART[item.icon] || "gem";   // `gem` is the never-blank fallback
  }

  // Must match the slug the fetch script saved files under, character for
  // character, or every photo silently falls back to line art.
  function slugFor(item) {
    return (item.brand + "-" + item.name).toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // A real photograph where one exists under a licence this site can ship, and
  // the drawn symbol everywhere else. PHOTOS is generated from what actually
  // downloaded, so it cannot name a file that is not in the repo.
  function orbMarkup(item) {
    var photo = (typeof PHOTOS !== "undefined") && PHOTOS[slugFor(item)];
    if (photo) {
      return '<span class="card-orb has-photo" aria-hidden="true">' +
        '<img class="card-photo" src="assets/photos/' + photo + '" alt="" loading="lazy" decoding="async">' +
        '</span>';
    }
    return '<span class="card-orb" aria-hidden="true">' +
      '<svg class="card-art" viewBox="0 0 24 24" aria-hidden="true"><use href="#art-' + artFor(item) + '"/></svg>' +
      '</span>';
  }

  // A missing symbol renders an empty orb and nothing throws, so the failure is
  // silent and only visible if you happen to look at that one card. Check the
  // whole dataset once, at load, and say so loudly.
  (function verifyAssets() {
    var missing = [];
    var missingPhotos = [];
    Object.keys(ROUNDS).forEach(function (cat) {
      ROUNDS[cat].forEach(function (round) {
        [round.a, round.b].forEach(function (item) {
          if (!ART[item.icon]) missing.push(cat + ": " + item.brand + " " + item.name + " (" + item.icon + ")");
          else if (!document.getElementById("art-" + ART[item.icon])) missing.push("no symbol #art-" + ART[item.icon]);
          if (typeof PHOTOS === "undefined" || !PHOTOS[slugFor(item)]) {
            missingPhotos.push(cat + ": " + item.brand + " " + item.name);
          }
        });
      });
    });
    if (missing.length) console.error("PRICESHOCK: items without art:", missing);
    if (missingPhotos.length) console.error("PRICESHOCK: items without photographs:", missingPhotos);
  })();

  // Anything mid-count registers a finisher here, so a skip can land on exactly
  // the state the animation would have reached — same text, same callbacks, same
  // order — rather than on a second, slightly different code path.
  var pendingFinishers = [];

  function skipReveal() {
    if (!pendingFinishers.length) return false;
    var list = pendingFinishers;
    pendingFinishers = [];
    list.forEach(function (finish) { finish(); });
    return true;
  }

  function countUp(node, target, done) {
    var start = performance.now();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var settled = false;

    // Guarded, because a skip and the last frame can both arrive: whichever is
    // first wins and the other becomes a no-op. Without this, `onDone` counts
    // twice and settle() runs on a half-revealed round.
    function finish() {
      if (settled) return;
      settled = true;
      node.textContent = money(target, true);
      if (done) done();
    }

    pendingFinishers.push(finish);
    if (reduce) { finish(); return; }

    function frame(now) {
      if (settled) return;        // skipped out from under us
      var t = Math.min((now - start) / COUNT_MS, 1);
      // easeOutExpo — fast at first, long tail. Feels like a slot machine.
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      node.textContent = money(target * eased);
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);
  }

  // The reveal is carried entirely by colour, glow and motion. This writes the
  // same outcome as plain text into the live region, which is the only way a
  // screen-reader user learns it. Called from settle() and never earlier:
  // announcing during the count-up would read the answer out before the
  // reveal lands.
  function announce(msg) {
    if (!el.live) return;
    el.live.textContent = msg;
  }

  function fireFlash() {
    el.flash.classList.remove("is-firing");
    void el.flash.offsetWidth;   // force reflow so the animation restarts
    el.flash.classList.add("is-firing");
  }

  function isDoubleRound(index) {
    var n = index + 1;
    return n === 5 || n === 10;
  }

  function payoutFor(streakAfterHit, index) {
    var base = BASE_POINTS + STREAK_STEP * (Math.min(streakAfterHit, STREAK_CAP) - 1);
    return base * (isDoubleRound(index) ? 2 : 1);
  }

  function updateHeat(afterRound) {
    var active = Math.max(1, Math.min(state.streak + 1, STREAK_CAP));
    Array.prototype.forEach.call(el.heatSteps, function (step) {
      step.classList.toggle("is-active", Number(step.dataset.heat) === active);
      step.classList.toggle("is-earned", Number(step.dataset.heat) < active);
    });
    var payoutIndex = afterRound ? state.index + 1 : state.index;
    if (payoutIndex >= ROUND_COUNT) {
      el.hudNext.textContent = "Run complete";
    } else {
      var next = payoutFor(Math.min(state.streak + 1, STREAK_CAP), payoutIndex);
      el.hudNext.textContent = (isDoubleRound(payoutIndex) ? "Next: double · " : "Next hit ") + "+" + next;
    }
    el.hudBestWrap.classList.toggle("is-beating", state.points > state.recordAtStart);
  }

  function choose(side) {
    if (state.locked) return;
    state.locked = true;

    var round = state.rounds[state.index];
    var pickedCard = side === "left" ? el.cardA : el.cardB;
    var otherCard = side === "left" ? el.cardB : el.cardA;
    var picked = side === "left" ? round.left : round.right;
    var other = side === "left" ? round.right : round.left;

    el.cardA.disabled = true;
    el.cardB.disabled = true;
    pickedCard.classList.add("is-picked");

    var correct = picked.price > other.price;
    var winner = picked.price >= other.price ? pickedCard : otherCard;
    var loser = winner === pickedCard ? otherCard : pickedCard;

    // Reveal both prices simultaneously.
    pendingFinishers = [];   // nothing from a previous round may leak into this one
    var finished = 0;
    function onDone() {
      finished += 1;
      if (finished < 2) return;
      settle();
    }

    [[el.cardA, round.left], [el.cardB, round.right]].forEach(function (pair) {
      var card = pair[0], item = pair[1];
      card.classList.add("is-revealed");
      card.querySelector(".card-note").textContent = item.note || "";
      countUp(card.querySelector("[data-price]"), item.price, onDone);
    });

    function settle() {
      winner.classList.add("is-winner");
      loser.classList.add("is-loser");
      pickedCard.classList.add(correct ? "is-picked-right" : "is-picked-wrong");

      var hi = Math.max(picked.price, other.price);
      var lo = Math.min(picked.price, other.price);
      var ratio = lo > 0 ? hi / lo : hi;
      var gap = hi - lo;

      if (ratio >= SHOCK_RATIO) fireFlash();

      // Points, and the streak that earned them. `score` stays the count of
      // correct answers because the ranks are keyed off it; `points` is the
      // number the player watches.
      var award = 0;
      if (correct) {
        state.score += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        award = payoutFor(state.streak, state.index);
        state.points += award;
      } else {
        state.streak = 0;
      }
      el.score.textContent = state.points;
      el.streak.hidden = state.streak < 2;
      el.streak.textContent = "🔥 " + state.streak + " in a row";
      updateHeat(true);

      el.award.className = "verdict-award " + (correct ? "is-right" : "is-wrong");
      el.award.textContent = correct ? "+" + award : "+0";
      el.awardNote.textContent = !correct
        ? "Streak lost"
        : state.streak >= 3
          ? state.streak + " in a row · " + (isDoubleRound(state.index) ? "double drop" : "+" + (award - BASE_POINTS) + " streak bonus")
          : isDoubleRound(state.index)
            ? "Double drop payout"
          : "";

      if (!state.biggestShock || ratio > state.biggestShock.ratio) {
        state.biggestShock = {
          ratio: ratio,
          winner: winnerItem(round),
          loser: loserItem(round),
        };
      }

      el.vTag.className = "verdict-tag " + (correct ? "is-right" : "is-wrong");
      el.vTag.textContent = correct
        ? (ratio >= SHOCK_RATIO ? "Correct — and brutal" : "Correct")
        : (ratio >= SHOCK_RATIO ? "Price shock" : "Wrong");

      el.vMult.textContent = formatMultiplier(ratio) + " more expensive";

      var winItem = winnerItem(round);
      el.vLine.innerHTML =
        "<strong>" + winItem.brand + " " + winItem.name + "</strong> wins by " +
        money(gap, true) + ".";
      el.vFact.textContent = round.fact || "";

      el.verdict.hidden = false;
      el.btnNext.textContent =
        state.index + 1 >= ROUND_COUNT ? "See results →" : "Next round →";
      el.progress.style.width = ((state.index + 1) / ROUND_COUNT) * 100 + "%";

      // Choosing a card disables it, which destroys the focus a keyboard
      // user was holding — focus fell to <body>, so continuing meant tabbing
      // from the top of the document, and the first stop was the back button:
      // one stray Enter and the run was abandoned. Move focus to the action
      // that is actually next. This restores focus rather than stealing it,
      // since the element that had it no longer accepts any.
      //
      // Before announce(), deliberately: a focus change can cut off an
      // in-flight polite announcement, so the move happens first and the
      // outcome is spoken after it.
      el.btnNext.focus();

      var loseIt = loserItem(round);
      announce(
        (correct ? "Correct. " : "Wrong. ") +
        winItem.brand + " " + winItem.name + ", " + money(hi, true) + ", costs " +
        formatMultiplier(ratio) + " more than " +
        loseIt.brand + " " + loseIt.name + ", " + money(lo, true) + ". " +
        (correct ? "Plus " + award + " points. " : "No points. ") +
        "Score " + state.points + ", " + state.score + " correct of " + (state.index + 1) + "."
      );

    }
  }

  function winnerItem(round) {
    return round.left.price >= round.right.price ? round.left : round.right;
  }
  function loserItem(round) {
    return round.left.price >= round.right.price ? round.right : round.left;
  }

  /* ---------------------------------------------------------------- flow */

  // Randomized has no ROUNDS entry; its pool is every other category's pairs,
  // gathered at the moment you press it. Built rather than stored so it cannot
  // fall out of step with the catalogue, and because `shuffle` then draws a
  // different ten every run — which is the whole point of the category.
  function poolFor(id) {
    if (id !== "random") return ROUNDS[id];
    var pool = [];
    Object.keys(ROUNDS).forEach(function (key) {
      pool = pool.concat(ROUNDS[key]);
    });
    return pool;
  }

  function startCategory(id) {
    var cat = CATEGORIES.filter(function (c) { return c.id === id; })[0];
    if (!cat) return;

    document.documentElement.style.setProperty("--accent", cat.accent);
    document.documentElement.style.setProperty("--accent-2", cat.accent2);

    state.categoryId = id;
    state.index = 0;
    state.score = 0;
    state.points = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.biggestShock = null;
    state.recordAtStart = records.best;

    // Randomise which side each item lands on, so position carries no signal.
    state.rounds = shuffle(poolFor(id)).slice(0, ROUND_COUNT).map(function (r) {
      var flip = Math.random() < 0.5;
      return {
        left: flip ? r.b : r.a,
        right: flip ? r.a : r.b,
        fact: r.fact,
      };
    });

    el.score.textContent = "0";
    el.streak.hidden = true;
    updateRecordDisplays();

    showScreen("game");
    renderRound();
  }

  function nextRound() {
    state.index += 1;
    if (state.index >= ROUND_COUNT) {
      showResults();
    } else {
      renderRound();
    }
  }

  var RANKS = [
    { min: 10, rank: "Market Maker", blurb: "Flawless. You either work in luxury retail or you have a worrying amount of free time." },
    { min: 8,  rank: "Shrewd Buyer",  blurb: "You know what things cost, which is rarer than it sounds." },
    { min: 6,  rank: "Sensible Shopper", blurb: "Solid instincts. The outliers got you, as they get everyone." },
    { min: 4,  rank: "Retail Optimist", blurb: "You assume things cost what they ought to. They do not." },
    { min: 2,  rank: "Price Blind",    blurb: "In fairness, none of this is rational." },
    { min: 0,  rank: "Delightfully Unaware", blurb: "Genuinely impressive. You'd have done better guessing at random." },
  ];

  function showResults() {
    var previousBest = records.best;
    var previousCategoryBest = Number(records.bestByCategory[state.categoryId]) || 0;
    var newRecord = state.points > previousBest;
    var newCategoryBest = state.points > previousCategoryBest;

    records.runs += 1;
    records.best = Math.max(records.best, state.points);
    records.bestByCategory[state.categoryId] = Math.max(previousCategoryBest, state.points);
    saveRecords();
    updateRecordDisplays();

    el.endScore.textContent = state.points.toLocaleString("en-US");

    // Rank is earned by being right, not by streak luck, so it still reads the
    // correct count — which is what the rank copy has always described.
    var r = RANKS.filter(function (x) { return state.score >= x.min; })[0];
    el.endRank.textContent = r.rank;
    el.endBlurb.textContent = r.blurb;
    // Ten out of ten is the only score that deserves its own reading of the
    // screen, so it gets the eyebrow, a class to style against, and the flash
    // the game otherwise saves for a genuine price shock.
    var perfect = state.score === ROUND_COUNT;
    el.screens.end.classList.toggle("is-perfect", perfect);
    el.endEyebrow.textContent = perfect ? "Perfect run" : "Final score";
    el.endTally.textContent = perfect
      ? ROUND_COUNT + " of " + ROUND_COUNT + " correct. Not one wrong."
      : state.score + " of " + ROUND_COUNT + " correct" +
        (state.bestStreak >= 2 ? " · best streak " + state.bestStreak + " in a row" : "");
    el.endRecord.classList.toggle("is-new", newRecord);
    el.endRecordLabel.textContent = newRecord ? "New house record" : (newCategoryBest ? "New category best" : "House record");
    el.endRecordNote.textContent = newRecord
      ? (previousBest ? "+" + (state.points - previousBest).toLocaleString("en-US") + " over your old best" : "First score on the board")
      : "Category best " + records.bestByCategory[state.categoryId].toLocaleString("en-US") + " pts";
    if (perfect) fireFlash();

    if (state.biggestShock) {
      var s = state.biggestShock;
      el.endWorst.innerHTML =
        "<h3>Biggest shock this run</h3>" +
        "<p><b>" + s.winner.brand + " " + s.winner.name + "</b> — " + money(s.winner.price, true) + "</p>" +
        "<p>beat <b>" + s.loser.brand + " " + s.loser.name + "</b> — " + money(s.loser.price, true) + "</p>" +
        "<p style='margin-top:.6rem'>That is <b>" + formatMultiplier(s.ratio) + "</b> the price.</p>";
    } else {
      el.endWorst.innerHTML = "";
    }

    showScreen("end");
  }

  /* ------------------------------------------------------------- wiring */

  // #rrggbb -> "rgba(r, g, b, a)". Written out rather than reached for from a
  // CSS color-mix(), because the cards have to tint correctly in browsers that
  // predate it and because doing it here keeps the card colour and the in-game
  // accent reading from one source: the CATEGORIES entry below.
  function rgba(hex, alpha) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " +
           (n & 255) + ", " + alpha + ")";
  }

  Array.prototype.forEach.call(document.querySelectorAll(".cat"), function (btn) {
    var cat = CATEGORIES.filter(function (c) { return c.id === btn.dataset.cat; })[0];
    if (cat) {
      btn.style.setProperty("--cat", cat.accent);
      btn.style.setProperty("--cat-2", cat.accent2);
      // Border strength, not fill: at full opacity the outline shouts louder
      // than the icon chip and the six cards start competing with each other.
      btn.style.setProperty("--cat-soft", rgba(cat.accent, 0.42));
    }
    btn.addEventListener("click", function () { startCategory(btn.dataset.cat); });
  });

  el.cardA.addEventListener("click", function () { choose("left"); });
  el.cardB.addEventListener("click", function () { choose("right"); });
  el.btnNext.addEventListener("click", nextRound);
  el.btnBack.addEventListener("click", function () { showScreen("title"); });
  el.btnCategories.addEventListener("click", function () { showScreen("title"); });
  el.btnAgain.addEventListener("click", function () { startCategory(state.categoryId); });

  // Keyboard: left/right to pick, Enter/Space to advance. Makes it playable
  // without a mouse and is genuinely faster.
  document.addEventListener("keydown", function (e) {
    if (!el.screens.game.classList.contains("is-active")) return;
    // Space during the count-up finishes it. Checked before the Enter/Space
    // advance below, because during a reveal the verdict is still hidden and
    // that branch cannot fire anyway — this is the only thing Space can mean.
    if ((e.key === " " || e.key === "Enter") && skipReveal()) { e.preventDefault(); return; }
    if (e.key === "ArrowLeft" && !state.locked) { e.preventDefault(); choose("left"); }
    else if (e.key === "ArrowRight" && !state.locked) { e.preventDefault(); choose("right"); }
    else if ((e.key === "Enter" || e.key === " ") && state.locked && !el.verdict.hidden) {
      e.preventDefault(); nextRound();
    }
  });

  // A click anywhere finishes the count-up too. It only ever does anything while
  // a reveal is in flight, so it can never steal a click from a control.
  document.addEventListener("click", function () { skipReveal(); }, true);

  updateRecordDisplays();
})();
