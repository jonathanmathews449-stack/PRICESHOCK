# PRICESHOCK

**Play: https://jonathanmathews449-stack.github.io/PRICESHOCK/**

Two things. One costs more. You have no idea which.

A Richard Mille wristwatch weighs 30 grams and costs four Lamborghini Huracáns.
A Hermès sandal costs five pairs of Air Max. Yeezy Slides lose to Birkenstocks.
This is a game about how thoroughly untethered prices have become.

Three categories — **Cars vs Watches**, **Luxury**, **Fashion** — ten rounds each.

## Running it

Open `index.html` in a browser. No build step, no dependencies, no package
manager, no trackers.

```
index.html          markup
assets/style.css    all styling — category colour comes from two CSS variables
assets/data.js      the items and prices
assets/app.js       game logic and the reveal
```

## About the prices

Approximate US retail in USD, checked September 2026. They drift — luxury goods
in particular are repriced once or twice a year and generally upward.

Where an item has no meaningful retail price (a one-off auction piece, or
something that only trades on the secondary market) the figure is labelled on
the card. A steel Daytona at its $16,900 list price and the ~$28,000 people
actually pay are different claims, and the game says which one it is using.

It's entertainment, not a valuation.

## Adding items

Add a pair to the right category in `assets/data.js`. The rules are in the
comment at the top of that file; the important ones:

- Every price must be checkable against a public source. Don't invent a number
  to make a pair land harder.
- Label auction and resale figures as such.
- Keep the two items plausibly comparable. The fun is a genuine "wait, *what?*",
  not a random mismatch.
