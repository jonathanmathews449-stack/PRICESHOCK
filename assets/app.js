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

  // House colours. The daily is not a category and should not borrow one of
  // their six hues, or it would read as "today you are playing Fashion".
  var DAILY_ACCENT = "#ff4d4d";
  var DAILY_ACCENT_2 = "#ffb03a";

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
    btnDaily: document.getElementById("btn-daily"),
    dailyNote: document.getElementById("daily-note"),
    dailyDate: document.getElementById("daily-date"),
    btnShare: document.getElementById("btn-share"),
    shareStatus: document.getElementById("share-status"),
    copyBox: document.getElementById("copybox"),
    copyText: document.getElementById("copybox-text"),
    copyClose: document.getElementById("copybox-close"),
    btnSound: document.getElementById("btn-sound"),
    soundLabel: document.getElementById("sound-label"),
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
    isDaily: false,
    dailyKey: null,
    results: [],
  };

  function loadRecords() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        best: Number(parsed.best) || 0,
        runs: Number(parsed.runs) || 0,
        bestByCategory: parsed.bestByCategory || {},
        // { date, best, plays } for ONE day only. Deliberately not a history:
        // a per-day archive is what turns "no trackers, no cookies, no
        // accounts" into a claim needing an asterisk, and nothing in the game
        // reads further back than today.
        daily: parsed.daily || null,
        // Sound is on unless the player has turned it off. `=== true` would
        // silence everyone who has a stored record from before this existed.
        muted: parsed.muted === true,
      };
    } catch (err) {
      return { best: 0, runs: 0, bestByCategory: {}, daily: null, muted: false };
    }
  }

  var records = loadRecords();

  function saveRecords() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
    catch (err) { /* Private browsing can deny storage; the game still works. */ }
  }

  /* Today only. A stored daily from an earlier date is not "your result" for
     this board — it was played on a different ten — so it is treated as absent
     rather than displayed against rounds it never belonged to. */
  function todaysDaily() {
    var d = records.daily;
    return (d && d.date === dailyKey()) ? d : null;
  }

  function updateDailyDisplay() {
    if (!el.btnDaily) return;
    var today = todaysDaily();
    // Formatted in UTC to match the seed. Showing a local date beside a board
    // chosen by the UTC one would put the wrong day on the button for anyone
    // far enough east or west.
    el.dailyDate.textContent = new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", timeZone: "UTC",
    });
    if (today) {
      el.dailyNote.textContent = "Played — " +
        today.best.toLocaleString("en-US") + " pts" +
        (today.plays > 1 ? ", best of " + today.plays : "") + " · play again";
      el.btnDaily.classList.add("is-done");
    } else {
      el.dailyNote.textContent = "Same ten rounds for everyone";
      el.btnDaily.classList.remove("is-done");
    }
  }


  function updateRecordDisplays() {
    var formatted = records.best.toLocaleString("en-US");
    el.titleBest.textContent = formatted;
    el.hudBest.textContent = formatted;
    el.endBest.textContent = formatted;
    el.titleBestNote.textContent = records.runs
      ? records.runs + (records.runs === 1 ? " run played" : " runs played")
      : "Set the first record";
    updateDailyDisplay();
  }

  /* ----------------------------------------------------- the daily seed */

  /* Everyone who plays on a given UTC day gets the same ten rounds, in the
     same order, with the same item on the same side. That needs a generator
     the page can drive itself — Math.random cannot be seeded — and it needs to
     stay a static site: no server, no request, nothing stored that identifies
     anybody. A date string is the only input.

     UTC, not local time. On local time two players either side of midnight
     would disagree about which day it is and get different boards while both
     believed they were comparing the same one. UTC is wrong for everybody by
     the same amount, which is the property that matters. */
  function dailyKey(now) {
    var d = now || new Date();
    return d.getUTCFullYear() + "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(d.getUTCDate()).padStart(2, "0");
  }

  // xmur3 to turn the date string into a 32-bit seed, mulberry32 to turn that
  // seed into a stream. Both are small, well-known and — the point here —
  // produce identical output from identical input in every browser, which a
  // hash built out of Math.random or Date.now would not.
  function seedFrom(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (Math.imul(h ^ (h >>> 16), 2246822507) ^
            Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------- utilities */

  // `rand` is injectable so the daily can pass a seeded stream. Everything else
  // passes nothing and gets Math.random, which is what a normal run wants.
  function shuffle(arr, rand) {
    var rng = rand || Math.random;
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
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
    // Leaving the results screen with the manual-copy dialog still open would
    // strand an aria-modal dialog over a screen it does not belong to.
    if (el.copyBox && !el.copyBox.hidden) closeCopyBox(false);
    // A "Copied" left over from the last run must not sit under a fresh result
    // as though this one had been copied.
    setShareStatus("");

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
      // One entry per round, in play order. The share card is built from this
      // rather than recomputed at the end, because by then the rounds have been
      // consumed and nothing remembers which ones were missed.
      state.results.push(correct);
      if (correct) {
        state.score += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        award = payoutFor(state.streak, state.index);
        state.points += award;
      } else {
        state.streak = 0;
      }

      /* Cues, in the order they would be heard. A streak note stacks on top of
         the correct note rather than replacing it, so two in a row still sounds
         like a correct answer that also happened to be a streak — replacing it
         made the streak read as a different, unrelated event. A Double Drop
         replaces both, because it is the loudest thing that can happen in a
         round and three cues at once is noise. */
      if (!correct) {
        SFX.wrong();
      } else if (isDoubleRound(state.index)) {
        SFX.doubleDrop();
      } else {
        SFX.correct();
        if (state.streak >= 2) SFX.streak(state.streak);
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

  /* One run setup, two ways in. `rand` decides everything that varies between
     runs — which ten pairs, their order, and which side each item lands on —
     so passing a seeded stream is the whole of what makes a daily a daily. */
  function beginRun(opts) {
    var pool = opts.pool;
    var rand = opts.rand || Math.random;

    state.categoryId = opts.categoryId;
    state.isDaily = !!opts.isDaily;
    state.dailyKey = opts.dailyKey || null;
    state.index = 0;
    state.score = 0;
    state.points = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.results = [];
    state.biggestShock = null;
    state.recordAtStart = records.best;

    // Randomise which side each item lands on, so position carries no signal.
    state.rounds = shuffle(pool, rand).slice(0, ROUND_COUNT).map(function (r) {
      var flip = rand() < 0.5;
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

  function startCategory(id) {
    var cat = CATEGORIES.filter(function (c) { return c.id === id; })[0];
    if (!cat) return;

    document.documentElement.style.setProperty("--accent", cat.accent);
    document.documentElement.style.setProperty("--accent-2", cat.accent2);

    beginRun({ categoryId: id, pool: poolFor(id) });
  }

  /* The daily draws from every category, like Randomized, but from a seeded
     stream instead of Math.random. Two consequences worth stating:

       * It is only stable as long as data.js is. Adding a pair changes the
         pool and therefore changes today's board mid-day for anyone who
         reloads after the deploy. That is accepted — the alternative is
         freezing a copy of the catalogue, which would rot.
       * `poolFor("random")` walks Object.keys(ROUNDS), whose order is the
         source order of the file and identical for every player loading the
         same deploy. If that ever stopped being true the daily would quietly
         differ between browsers, so do not sort or filter it here. */
  function startDaily() {
    var key = dailyKey();
    document.documentElement.style.setProperty("--accent", DAILY_ACCENT);
    document.documentElement.style.setProperty("--accent-2", DAILY_ACCENT_2);
    beginRun({
      categoryId: "daily",
      isDaily: true,
      dailyKey: key,
      pool: poolFor("random"),
      rand: mulberry32(seedFrom("priceshock-daily-" + key)),
    });
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

    /* The daily records apart from the category bests. It is not one of the
       six, and writing it into bestByCategory would put a seventh row into a
       structure the category-best line reads from and show "Category best" on
       a screen that never mentioned a category.

       A replay keeps the higher of the two rather than the latest. The board
       is fixed for the day, so the first honest attempt and a fourth informed
       one are not the same achievement — but nothing here can tell them apart,
       and quietly overwriting a good score with a worse one is the more
       annoying of the two ways to be wrong. `plays` makes the replay visible
       instead of hiding it. */
    if (state.isDaily) {
      var prior = todaysDaily();
      records.daily = {
        date: state.dailyKey,
        best: Math.max(prior ? prior.best : 0, state.points),
        plays: (prior ? prior.plays : 0) + 1,
      };
    } else {
      records.bestByCategory[state.categoryId] = Math.max(previousCategoryBest, state.points);
    }
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
    /* The daily has no category, so neither the label nor the note may reach
       into bestByCategory — before this branch existed that line read
       `undefined.toLocaleString()` and threw on the results screen. */
    if (state.isDaily) {
      var todayBest = todaysDaily();
      el.endRecordLabel.textContent = newRecord ? "New house record" : "Today’s challenge";
      el.endRecordNote.textContent = newRecord
        ? (previousBest ? "+" + (state.points - previousBest).toLocaleString("en-US") + " over your old best" : "First score on the board")
        : "Best today " + (todayBest ? todayBest.best.toLocaleString("en-US") : "0") + " pts";
    } else {
      el.endRecordLabel.textContent = newRecord ? "New house record" : (newCategoryBest ? "New category best" : "House record");
      el.endRecordNote.textContent = newRecord
        ? (previousBest ? "+" + (state.points - previousBest).toLocaleString("en-US") + " over your old best" : "First score on the board")
        : "Category best " + records.bestByCategory[state.categoryId].toLocaleString("en-US") + " pts";
    }
    if (perfect) { fireFlash(); SFX.perfect(); }

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

  /* --------------------------------------------------------------- sound */

  /* Synthesised, not sampled. Five short cues would be five binary files to
     licence, credit, ship and keep in the publish manifest, and the whole site
     is buildless — WebAudio costs a hundred lines and nothing else.

     Three rules this obeys, in order of how badly breaking them reads:

       1. Nothing is created before a user gesture. Browsers refuse to start an
          AudioContext without one, and constructing it early just yields a
          suspended context and a console warning on every load. The context is
          built inside the first play() that follows a real interaction.
       2. Muted means silent AND inert — no context at all. A muted player
          should not have an audio graph running for nothing.
       3. Every entry point is wrapped. Audio is a garnish; a browser that
          refuses it must cost the player nothing and log nothing. */
  var audio = { ctx: null, master: null, failed: false };

  function audioReady() {
    if (records.muted || audio.failed) return null;
    if (audio.ctx) {
      // Chrome suspends the context when it is created too eagerly, and again
      // when a tab is backgrounded. Resuming is cheap and a no-op when running.
      if (audio.ctx.state === "suspended") { try { audio.ctx.resume(); } catch (e) {} }
      return audio.ctx;
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { audio.failed = true; return null; }
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      // Deliberately quiet. These play over whatever the player already has on.
      audio.master.gain.value = 0.16;
      audio.master.connect(audio.ctx.destination);
      return audio.ctx;
    } catch (err) {
      audio.failed = true;
      return null;
    }
  }

  /* One voice: an oscillator, a gain envelope, and a stop. The envelope matters
     more than the waveform — a gain that jumps to its value instead of ramping
     produces a click on every note, which is the difference between a cue and
     a pop. */
  function tone(opts) {
    var ctx = audioReady();
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (opts.delay || 0);
      var dur = opts.dur || 0.12;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = opts.type || "triangle";
      osc.frequency.setValueAtTime(opts.from, t0);
      if (opts.to && opts.to !== opts.from) {
        osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(opts.peak || 1, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) { /* A refused note is not worth a broken round. */ }
  }

  var SFX = {
    // Up a fifth, quickly. Rising reads as "yes" without needing a tune.
    correct: function () {
      tone({ from: 620, to: 930, dur: 0.11, peak: 0.9 });
      tone({ from: 930, to: 1240, dur: 0.16, delay: 0.08, peak: 0.55 });
    },
    // Down, and squarer. Short enough not to editorialise about being wrong.
    wrong: function () {
      tone({ from: 260, to: 150, dur: 0.24, type: "sawtooth", peak: 0.5 });
    },
    /* Pitched by streak length so three in a row and five in a row are audibly
       different events rather than the same ding repeated. Capped with the
       payout ladder — past STREAK_CAP nothing more is earned, so nothing more
       is promised. */
    streak: function (n) {
      var step = Math.min(n, STREAK_CAP);
      var base = 660 * Math.pow(1.122, step);   // ~a semitone per step
      tone({ from: base, to: base * 1.5, dur: 0.13, peak: 0.75 });
    },
    // Two notes and a fifth above: the only cue that is allowed to sound big.
    doubleDrop: function () {
      tone({ from: 440, to: 660, dur: 0.18, peak: 0.85 });
      tone({ from: 660, to: 880, dur: 0.22, delay: 0.1, peak: 0.8 });
      tone({ from: 1320, to: 1320, dur: 0.3, delay: 0.18, peak: 0.4, type: "sine" });
    },
    // Ten from ten. A four-note arpeggio, the longest thing the game plays.
    perfect: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ from: f, to: f, dur: 0.22, delay: i * 0.11, peak: 0.7, type: "sine" });
      });
    },
  };

  function setMuted(muted) {
    records.muted = !!muted;
    saveRecords();
    if (records.muted && audio.ctx) {
      // Tear the graph down rather than leaving it suspended: muted should mean
      // the page is not holding an audio device open.
      try { audio.ctx.close(); } catch (err) {}
      audio.ctx = null;
      audio.master = null;
    }
    updateSoundToggle();
  }

  function updateSoundToggle() {
    if (!el.btnSound) return;
    var on = !records.muted;
    el.btnSound.setAttribute("aria-pressed", on ? "true" : "false");
    el.btnSound.classList.toggle("is-muted", !on);
    el.soundLabel.textContent = on ? "Sound" : "Muted";
  }

  /* ------------------------------------------------------- share a result */

  var SHARE_URL = "https://jonathanmathews449-stack.github.io/PRICESHOCK/";

  /* What the card may and may not say.

     It carries the player's own outcome per round — right or wrong — and never
     which item was pricier, what anything cost, or what was in the round. That
     is the whole constraint: on a daily, everybody is playing the same ten, so
     a card that leaked the answers would ruin the board for whoever it was sent
     to. Squares are safe because they describe the sender, not the question. */
  function shareText() {
    var squares = state.results.map(function (ok) {
      return ok ? "🟩" : "🟥";   // green / red square
    });
    // Split 5 and 5. Ten in a row wraps unpredictably in chat clients and the
    // break makes the run scannable at a glance.
    var grid = squares.slice(0, 5).join("") + " " + squares.slice(5).join("");

    var heading;
    if (state.isDaily) {
      heading = "Daily · " + new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", timeZone: "UTC",
      });
    } else {
      var cat = CATEGORIES.filter(function (c) { return c.id === state.categoryId; })[0];
      heading = cat ? cat.name : "Mixed";
    }

    var lines = [
      "PRICESHOCK — " + heading,
      state.points.toLocaleString("en-US") + " pts · " +
        state.score + "/" + ROUND_COUNT,
      grid,
    ];
    if (state.bestStreak >= 2) {
      lines.push("Best streak " + state.bestStreak + " in a row");
    }
    if (state.score === ROUND_COUNT) lines.push("Perfect run.");
    lines.push(SHARE_URL);
    return lines.join("\n");
  }

  function setShareStatus(msg) {
    if (el.shareStatus) el.shareStatus.textContent = msg;
  }

  /* The manual fallback, and the reason it exists: the Clipboard API rejects
     without a permission in some browsers, and `execCommand("copy")` is gone or
     disabled in others. When both refuse there is still something useful to do
     — show the text, select it, and let the player press the keys themselves.
     Anything less leaves a button that appears to do nothing. */
  function openCopyBox(text) {
    el.copyText.value = text;
    el.copyBox.hidden = false;
    el.copyText.focus();
    el.copyText.select();
    setShareStatus("Copy it by hand — the text is selected.");
  }

  /* Focus goes back to the share button by name, not to whatever
     `document.activeElement` was when the dialog opened. That reading is not
     reliable — a click does not always move focus, so it can capture <body>,
     and <body> is not focusable, so calling focus() on it leaves focus inside
     the dialog that has just been hidden. Since this dialog can only ever be
     opened by that one button, naming it is both simpler and correct. */
  function closeCopyBox(returnFocus) {
    el.copyBox.hidden = true;
    // showScreen() passes false: it closes the dialog on the way OUT of the
    // results screen, and focusing a button there would drag focus back onto
    // the screen being left.
    if (returnFocus !== false && el.btnShare) el.btnShare.focus();
  }

  // Selection-copy, the middle rung. Uses a real textarea because a hidden or
  // zero-size one is not selectable in every browser, and reads back
  // execCommand's return value — it reports failure rather than throwing.
  function copyBySelection(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  }

  function shareResult() {
    var text = shareText();

    // Clipboard API first, its fallbacks in order. Every branch ends in a
    // message: a copy that silently fails is worse than one that admits it.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setShareStatus("Copied. Paste it wherever you like.");
      }, function () {
        if (copyBySelection(text)) setShareStatus("Copied. Paste it wherever you like.");
        else openCopyBox(text);
      });
      return;
    }
    if (copyBySelection(text)) setShareStatus("Copied. Paste it wherever you like.");
    else openCopyBox(text);
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
  // "Play again" has to remember which kind of run it was: on a daily it must
  // re-seed today rather than fall through to startCategory("daily"), which
  // would find no such category and silently do nothing.
  el.btnAgain.addEventListener("click", function () {
    if (state.isDaily) startDaily(); else startCategory(state.categoryId);
  });
  el.btnDaily.addEventListener("click", startDaily);

  // Unhidden here, not in the markup: without script it silences nothing.
  el.btnSound.hidden = false;
  updateSoundToggle();
  el.btnSound.addEventListener("click", function () { setMuted(!records.muted); });
  el.btnShare.addEventListener("click", shareResult);
  // Wrapped, not passed by reference: the listener would hand the event object
  // to closeCopyBox as its returnFocus argument.
  el.copyClose.addEventListener("click", function () { closeCopyBox(true); });

  // Escape closes the manual-copy dialog. Without it the only way out is the
  // Done button, which a keyboard user reaches only after tabbing through the
  // textarea they were told to press Ctrl+C in.
  el.copyBox.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.stopPropagation(); closeCopyBox(true); }
  });

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
