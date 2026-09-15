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
  var COUNT_MS = 1100;          // price count-up duration
  var SHOCK_RATIO = 3;          // at or above this, it's a "PRICE SHOCK"

  // Scoring. A correct answer is worth BASE; each consecutive correct answer
  // after the first adds STREAK_STEP, up to STREAK_CAP in a row. So 1st 100,
  // 2nd 150, 3rd 200, 4th 250, 5th and beyond 300 — a perfect run is 2,500.
  // Rank still keys off the correct COUNT, not points, so the existing rank
  // copy stays true and a lucky streak cannot buy a better title.
  var BASE_POINTS = 100;
  var STREAK_STEP = 50;
  var STREAK_CAP = 5;

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
    streak: document.getElementById("hud-streak"),
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
  };

  /* ---------------------------------------------------------- utilities */

  function shuffle(arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function money(n) {
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

    var active = el.screens[name];
    if (active && typeof active.focus === "function") active.focus();
  }

  /* ------------------------------------------------------------- render */

  function cardMarkup(item) {
    return (
      '<span class="card-pick">your pick</span>' +
      '<span class="card-orb" aria-hidden="true"><svg class="card-art" viewBox="0 0 24 24" aria-hidden="true"><use href="#art-' + artFor(item) + '"/></svg></span>' +
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

    [el.cardA, el.cardB].forEach(function (card) {
      card.className = "card";
      card.disabled = false;
    });

    el.cardA.innerHTML = cardMarkup(round.left);
    el.cardB.innerHTML = cardMarkup(round.right);
    el.cardA.setAttribute("aria-label", "Choose " + round.left.brand + " " + round.left.name);
    el.cardB.setAttribute("aria-label", "Choose " + round.right.brand + " " + round.right.name);

    el.verdict.hidden = true;
    el.round.textContent = "Round " + (state.index + 1) + " / " + ROUND_COUNT;
    el.progress.style.width = (state.index / ROUND_COUNT) * 100 + "%";
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
  };

  function artFor(item) {
    return ART[item.icon] || "gem";   // `gem` is the never-blank fallback
  }

  // A missing symbol renders an empty orb and nothing throws, so the failure is
  // silent and only visible if you happen to look at that one card. Check the
  // whole dataset once, at load, and say so loudly.
  (function verifyArt() {
    var missing = [];
    Object.keys(ROUNDS).forEach(function (cat) {
      ROUNDS[cat].forEach(function (round) {
        [round.a, round.b].forEach(function (item) {
          if (!ART[item.icon]) missing.push(cat + ": " + item.brand + " " + item.name + " (" + item.icon + ")");
          else if (!document.getElementById("art-" + ART[item.icon])) missing.push("no symbol #art-" + ART[item.icon]);
        });
      });
    });
    if (missing.length) console.error("PRICESHOCK: items without art:", missing);
  })();

  function countUp(node, target, done) {
    var start = performance.now();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      node.textContent = money(target);
      if (done) done();
      return;
    }

    function frame(now) {
      var t = Math.min((now - start) / COUNT_MS, 1);
      // easeOutExpo — fast at first, long tail. Feels like a slot machine.
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      node.textContent = money(target * eased);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        node.textContent = money(target);
        if (done) done();
      }
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
        award = BASE_POINTS + STREAK_STEP * (Math.min(state.streak, STREAK_CAP) - 1);
        state.points += award;
      } else {
        state.streak = 0;
      }
      el.score.textContent = state.points;
      el.streak.hidden = state.streak < 2;
      el.streak.textContent = "🔥 " + state.streak + " in a row";

      el.award.className = "verdict-award " + (correct ? "is-right" : "is-wrong");
      el.award.textContent = correct ? "+" + award : "+0";
      el.awardNote.textContent = !correct
        ? "Streak lost"
        : state.streak >= 3
          ? state.streak + " in a row · +" + (award - BASE_POINTS) + " streak bonus"
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
        money(gap) + ".";
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
        winItem.brand + " " + winItem.name + ", " + money(hi) + ", costs " +
        formatMultiplier(ratio) + " more than " +
        loseIt.brand + " " + loseIt.name + ", " + money(lo) + ". " +
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

    // Randomise which side each item lands on, so position carries no signal.
    state.rounds = shuffle(ROUNDS[id]).slice(0, ROUND_COUNT).map(function (r) {
      var flip = Math.random() < 0.5;
      return {
        left: flip ? r.b : r.a,
        right: flip ? r.a : r.b,
        fact: r.fact,
      };
    });

    el.score.textContent = "0";
    el.streak.hidden = true;

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
    el.endScore.textContent = state.points.toLocaleString("en-US");

    // Rank is earned by being right, not by streak luck, so it still reads the
    // correct count — which is what the rank copy has always described.
    var r = RANKS.filter(function (x) { return state.score >= x.min; })[0];
    el.endRank.textContent = r.rank;
    el.endBlurb.textContent = r.blurb;
    el.endEyebrow.textContent = "Final score";
    el.endTally.textContent =
      state.score + " of " + ROUND_COUNT + " correct" +
      (state.bestStreak >= 2 ? " · best streak " + state.bestStreak + " in a row" : "");

    if (state.biggestShock) {
      var s = state.biggestShock;
      el.endWorst.innerHTML =
        "<h3>Biggest shock this run</h3>" +
        "<p><b>" + s.winner.brand + " " + s.winner.name + "</b> — " + money(s.winner.price) + "</p>" +
        "<p>beat <b>" + s.loser.brand + " " + s.loser.name + "</b> — " + money(s.loser.price) + "</p>" +
        "<p style='margin-top:.6rem'>That is <b>" + formatMultiplier(s.ratio) + "</b> the price.</p>";
    } else {
      el.endWorst.innerHTML = "";
    }

    showScreen("end");
  }

  /* ------------------------------------------------------------- wiring */

  Array.prototype.forEach.call(document.querySelectorAll(".cat"), function (btn) {
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
    if (e.key === "ArrowLeft" && !state.locked) { e.preventDefault(); choose("left"); }
    else if (e.key === "ArrowRight" && !state.locked) { e.preventDefault(); choose("right"); }
    else if ((e.key === "Enter" || e.key === " ") && state.locked && !el.verdict.hidden) {
      e.preventDefault(); nextRound();
    }
  });
})();
