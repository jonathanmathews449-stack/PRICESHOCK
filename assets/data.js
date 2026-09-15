/* ==========================================================================
   PRICESHOCK — item data
   --------------------------------------------------------------------------
   Prices are approximate US retail in USD unless the note says otherwise
   (some items only exist on the secondary/auction market, where retail is
   meaningless — those are labelled).

   RULES FOR EDITING, please keep to them:
     1. Every price must be checkable against a public source. Don't invent a
        number to make a pair more dramatic.
     2. If a price is auction or resale rather than retail, say so in `note`.
        A Daytona at retail and a Daytona on the grey market are different
        claims and the gap between them is nearly 2x.
     3. Prices drift. `verified` records when the figure was last checked.
     4. Keep the two items in a pair plausibly comparable — the fun comes from
        a genuine "wait, WHAT?", not from a random mismatch.
   ========================================================================== */

const CATEGORIES = [
  {
    id: "cars-watches",
    name: "Cars vs Watches",
    tagline: "Four wheels or one wrist",
    icon: "🏎️",
    accent: "#ff4d4d",
    accent2: "#ffb03a",
  },
  {
    id: "luxury",
    name: "Luxury",
    tagline: "Leather, gold and very small bags",
    icon: "💎",
    accent: "#c9a227",
    accent2: "#f5e6a8",
  },
  {
    id: "fashion",
    name: "Fashion",
    tagline: "Everyday things, silly prices",
    icon: "👟",
    accent: "#7b6cff",
    accent2: "#38e8ff",
  },
  {
    id: "launch-prices",
    name: "Launch Prices",
    tagline: "What it cost on day one",
    icon: "📟",
    accent: "#2fc48a",
    accent2: "#9ff2cd",
  },
  {
    id: "tech",
    name: "Tech",
    tagline: "Silicon, screens and one cloth",
    icon: "🖥️",
    accent: "#3d8bff",
    accent2: "#8fd0ff",
  },
  {
    // Has no entry in ROUNDS on purpose. app.js builds its pool from every other
    // category at the moment you press it, so it can never drift out of sync
    // with the catalogue the way a hand-copied list would.
    id: "random",
    name: "Randomized",
    tagline: "Everything, shuffled together",
    icon: "🎲",
    accent: "#c46bff",
    accent2: "#f2b8ff",
  },
];

const ROUNDS = {
  /* ---------------------------------------------------------------- CARS */
  "cars-watches": [
    {
      a: { brand: "Rolex", name: "Submariner Date 126610LN", icon: "⌚", price: 10250,
           note: "retail", verified: "2026-09" },
      b: { brand: "Toyota", name: "Camry (2026)", icon: "🚙", price: 30495,
           note: "MSRP", verified: "2026-09" },
      fact: "A Camry costs about three Submariners. The Submariner is the one with the waiting list.",
    },
    {
      a: { brand: "Richard Mille", name: "RM 27-04 Tourbillon Rafael Nadal", icon: "⌚", price: 1000050,
           note: "retail, CHF 952,000", verified: "2026-09" },
      b: { brand: "Lamborghini", name: "Huracán", icon: "🏎️", price: 215000,
           note: "base MSRP", verified: "2026-09" },
      fact: "The watch weighs 30 grams. You could buy four Huracáns and still have change.",
    },
    {
      a: { brand: "Patek Philippe", name: "Grandmaster Chime 6300A-010", icon: "⌚", price: 31000000,
           note: "2019 charity auction — one of one", verified: "2026-09" },
      b: { brand: "Bugatti", name: "Chiron", icon: "🏎️", price: 3300000,
           note: "approx. new", verified: "2026-09" },
      fact: "The most expensive wristwatch ever sold. Nine Chirons, on one wrist.",
    },
    {
      a: { brand: "Audemars Piguet", name: "Royal Oak 'Jumbo' 15202", icon: "⌚", price: 35000,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Tesla", name: "Model 3", icon: "🚗", price: 42500,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "Closer than it looks. On the secondary market the Royal Oak wins comfortably.",
    },
    {
      a: { brand: "Omega", name: "Speedmaster Professional Moonwatch", icon: "⌚", price: 7400,
           note: "retail", verified: "2026-09" },
      b: { brand: "Vespa", name: "Primavera 150", icon: "🛵", price: 4300,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "The watch went to the Moon. The Vespa struggles with hills.",
    },
    {
      a: { brand: "Rolex", name: "Daytona 126500LN (steel)", icon: "⌚", price: 16900,
           note: "retail — grey market is roughly $28,000", verified: "2026-09" },
      b: { brand: "Honda", name: "Civic Si", icon: "🚗", price: 31000,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "At retail the Civic wins. At the price you can actually buy a Daytona, it doesn't.",
    },
    {
      a: { brand: "Patek Philippe", name: "Nautilus 5711/1A", icon: "⌚", price: 100000,
           note: "secondary market — discontinued", verified: "2026-09" },
      b: { brand: "Porsche", name: "911 Carrera (2026)", icon: "🏎️", price: 135500,
           note: "MSRP inc. destination", verified: "2026-09" },
      fact: "Patek stopped making the 5711 in 2021. The price went up, not down.",
    },
    {
      a: { brand: "Cartier", name: "Santos de Cartier (large)", icon: "⌚", price: 7650,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Mazda", name: "MX-5 Miata", icon: "🚗", price: 29500,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "The Santos was built in 1904 for a pilot who couldn't check a pocket watch mid-flight.",
    },
    {
      a: { brand: "Richard Mille", name: "RM 11-03 Flyback Chronograph", icon: "⌚", price: 200000,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Ferrari", name: "Roma", icon: "🏎️", price: 247000,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "A photo finish. Spec the Ferrari at all and the watch loses.",
    },
    {
      a: { brand: "Rolex", name: "GMT-Master II 'Pepsi'", icon: "⌚", price: 11050,
           note: "retail", verified: "2026-09" },
      b: { brand: "Ford", name: "Bronco (base)", icon: "🚙", price: 39000,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "Designed for Pan Am pilots crossing time zones. Now mostly crosses office carparks.",
    },
  ],

  /* -------------------------------------------------------------- LUXURY */
  luxury: [
    {
      a: { brand: "Hermès", name: "Birkin 25, Togo leather", icon: "👜", price: 13500,
           note: "US retail", verified: "2026-09" },
      b: { brand: "Chanel", name: "Classic Flap, medium", icon: "👛", price: 10800,
           note: "approx. retail", verified: "2026-09" },
      fact: "Both have roughly quadrupled in a decade. The Birkin is still the harder one to be allowed to buy.",
    },
    {
      a: { brand: "Hermès", name: "Birkin Himalaya, Niloticus crocodile", icon: "👜", price: 380000,
           note: "auction — not sold at retail", verified: "2026-09" },
      b: { brand: "Porsche", name: "911 Turbo S", icon: "🏎️", price: 231000,
           note: "approx. MSRP", verified: "2026-09" },
      fact: "A handbag. It outruns the 911 on price by a comfortable margin.",
    },
    {
      a: { brand: "Goyard", name: "Saint Louis GM tote", icon: "👜", price: 1750,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Apple", name: "Vision Pro", icon: "🥽", price: 3499,
           note: "retail", verified: "2026-09" },
      fact: "The tote is canvas and has no pockets. It will outlive the headset by decades.",
    },
    {
      a: { brand: "Louis Vuitton", name: "Neverfull MM", icon: "👜", price: 2300,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Peloton", name: "Bike+", icon: "🚲", price: 2495,
           note: "retail", verified: "2026-09" },
      fact: "Within $200 of each other. Only one of them gets used after February.",
    },
    {
      a: { brand: "Dom Pérignon", name: "Vintage Brut, one bottle", icon: "🍾", price: 220,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Louis Vuitton", name: "Initiales reversible belt", icon: "👔", price: 600,
           note: "approx. retail", verified: "2026-09" },
      fact: "The belt costs nearly three bottles of the world's most famous champagne.",
    },
    {
      a: { brand: "Cartier", name: "Love bracelet, yellow gold", icon: "💛", price: 7350,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Apple", name: "MacBook Pro 16\" M4 Max", icon: "💻", price: 3999,
           note: "retail", verified: "2026-09" },
      fact: "The bracelet comes with a screwdriver. That is the entire gimmick, and it works.",
    },
    {
      a: { brand: "Rimowa", name: "Original Cabin, aluminium", icon: "🧳", price: 1450,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Dyson", name: "Airwrap Complete", icon: "💨", price: 599,
           note: "retail", verified: "2026-09" },
      fact: "You are paying roughly $850 for the sound the latches make.",
    },
    {
      a: { brand: "Bottega Veneta", name: "Jodie, small", icon: "👜", price: 4000,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Tiffany & Co.", name: "1ct solitaire engagement ring", icon: "💍", price: 14000,
           note: "approx., varies by grade", verified: "2026-09" },
      fact: "Diamond pricing is enormously grade-dependent — this is a mid-range stone.",
    },
    {
      a: { brand: "Montblanc", name: "Meisterstück 149 fountain pen", icon: "🖋️", price: 1080,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Apple", name: "iPhone 17 Pro (256GB)", icon: "📱", price: 1099,
           note: "approx. retail", verified: "2026-09" },
      fact: "A pen designed in 1924, priced within $20 of a supercomputer you keep in your pocket.",
    },
    {
      a: { brand: "Hermès", name: "Avalon blanket", icon: "🧣", price: 1800,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Samsung", name: "65\" OLED S95F TV", icon: "📺", price: 2300,
           note: "approx. retail", verified: "2026-09" },
      fact: "It is a blanket. A very good blanket, but a blanket.",
    },
  ],

  /* ------------------------------------------------------------- FASHION */
  fashion: [
    {
      a: { brand: "adidas", name: "Yeezy Slide", icon: "🩴", price: 70,
           note: "retail", verified: "2026-09" },
      b: { brand: "Birkenstock", name: "Arizona, suede", icon: "🩴", price: 110,
           note: "retail", verified: "2026-09" },
      fact: "The foam slab loses to the sandal your geography teacher wore.",
    },
    {
      a: { brand: "Nike", name: "Air Force 1 '07", icon: "👟", price: 115,
           note: "retail", verified: "2026-09" },
      b: { brand: "Levi's", name: "501 Original jeans", icon: "👖", price: 98,
           note: "retail", verified: "2026-09" },
      fact: "Two things that have barely changed design in forty years, priced almost identically.",
    },
    {
      a: { brand: "Jordan", name: "Air Jordan 1 Retro High OG", icon: "👟", price: 180,
           note: "retail", verified: "2026-09" },
      b: { brand: "Common Projects", name: "Original Achilles Low", icon: "👞", price: 425,
           note: "approx. retail", verified: "2026-09" },
      fact: "The plain white pair costs more than double. The gold stamp is the whole product.",
    },
    {
      a: { brand: "Balenciaga", name: "Triple S trainer", icon: "👟", price: 1190,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Golden Goose", name: "Super-Star (pre-scuffed)", icon: "👟", price: 625,
           note: "approx. retail", verified: "2026-09" },
      fact: "One is deliberately chunky, the other is deliberately dirty. Both are deliberate.",
    },
    {
      a: { brand: "Canada Goose", name: "Expedition Parka", icon: "🧥", price: 1395,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Moncler", name: "Maya down jacket", icon: "🧥", price: 2050,
           note: "approx. retail", verified: "2026-09" },
      fact: "The Expedition was designed for Antarctic research stations. Most never see snow.",
    },
    {
      a: { brand: "Patagonia", name: "Nano Puff jacket", icon: "🧥", price: 239,
           note: "retail", verified: "2026-09" },
      b: { brand: "Uniqlo", name: "Ultra Light Down jacket", icon: "🧥", price: 70,
           note: "approx. retail", verified: "2026-09" },
      fact: "Roughly three and a half Uniqlo jackets to one Patagonia.",
    },
    {
      a: { brand: "Hermès", name: "Oran sandal", icon: "🩴", price: 790,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Nike", name: "Air Max 1", icon: "👟", price: 150,
           note: "retail", verified: "2026-09" },
      fact: "One strip of calfskin and a sole. Five Air Max.",
    },
    {
      a: { brand: "Supreme", name: "Box Logo hoodie", icon: "👕", price: 168,
           note: "retail — resale routinely 5x", verified: "2026-09" },
      b: { brand: "Balenciaga", name: "logo T-shirt", icon: "👕", price: 650,
           note: "approx. retail", verified: "2026-09" },
      fact: "At retail it isn't close. At resale, the hoodie often wins.",
    },
    {
      a: { brand: "Ray-Ban", name: "Wayfarer Classic", icon: "🕶️", price: 171,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Oakley", name: "Holbrook", icon: "🕶️", price: 136,
           note: "approx. retail", verified: "2026-09" },
      fact: "Both are owned by the same company, EssilorLuxottica. So is the shop selling them.",
    },
    {
      a: { brand: "Dr. Martens", name: "1460 8-eye boot", icon: "🥾", price: 170,
           note: "approx. retail", verified: "2026-09" },
      b: { brand: "Timberland", name: "6-Inch Premium boot", icon: "🥾", price: 208,
           note: "approx. retail", verified: "2026-09" },
      fact: "The Docs were invented by a German army doctor recovering from a skiing injury.",
    },
  ],

  /* ------------------------------------------------------- LAUNCH PRICES */
  /* Every figure here is the price on the day the thing went on sale, in the
     dollars of that year — not adjusted for inflation, because the game is a
     comparison between two numbers and adjusting one would make it a
     comparison between two different things. `note` always carries the year,
     so nothing is being smuggled past the reader.

     Where a price had cents, the exact figure is in `note`: the display
     rounds, and $699.99 shown as "$700" would be a small lie in a game whose
     whole footing is that its numbers are checkable. */
  "launch-prices": [
    {
      a: { brand: "Apple", name: "Macintosh 128K", icon: "🖥️", price: 2495,
           note: "launch price, January 1984", verified: "2026-09" },
      b: { brand: "Motorola", name: "DynaTAC 8000X", icon: "📱", price: 3995,
           note: "launch price, 1984", verified: "2026-09" },
      fact: "The same year. The telephone cost more than the computer, and the telephone could only make telephone calls.",
    },
    {
      a: { brand: "Apple", name: "Lisa", icon: "🖥️", price: 9995,
           note: "base price at launch, January 1983", verified: "2026-09" },
      b: { brand: "Segway", name: "Human Transporter", icon: "🛴", price: 5000,
           note: "price at launch, 2001", verified: "2026-09" },
      fact: "Two of the most confidently launched products in the business, eighteen years apart. The Lisa was twice the price.",
    },
    {
      a: { brand: "IBM", name: "Personal Computer 5150", icon: "🖥️", price: 1565,
           note: "base configuration, August 1981 — 16 KB RAM, no disk drive", verified: "2026-09" },
      b: { brand: "Commodore", name: "64", icon: "⌨️", price: 595,
           note: "launch price, 1982", verified: "2026-09" },
      fact: "The IBM price bought sixteen kilobytes of memory and no disk drive at all.",
    },
    {
      a: { brand: "3DO", name: "Interactive Multiplayer", icon: "🕹️", price: 700,
           note: "US launch, October 1993 — $699.99", verified: "2026-09" },
      b: { brand: "Atari", name: "Jaguar", icon: "🕹️", price: 250,
           note: "US launch, November 1993 — $249.95", verified: "2026-09" },
      fact: "Six weeks apart, in the same year, at nearly three times the price.",
    },
    {
      a: { brand: "Sony", name: "PlayStation", icon: "🎮", price: 299,
           note: "US launch, September 1995", verified: "2026-09" },
      b: { brand: "Nintendo", name: "Nintendo 64", icon: "🎮", price: 200,
           note: "US launch, September 1996 — $199.99", verified: "2026-09" },
      fact: "Sony announced its price on stage at E3 as an entire speech: “Two ninety-nine.”",
    },
    {
      a: { brand: "Sega", name: "Saturn", icon: "🎮", price: 399,
           note: "US launch, May 1995 — included Virtua Fighter", verified: "2026-09" },
      b: { brand: "Sega", name: "Dreamcast", icon: "🎮", price: 199,
           note: "US launch, 9 September 1999", verified: "2026-09" },
      fact: "Sega's next console cost half as much four years later. The marketing was the price: “9/9/99 for $199.”",
    },
    {
      a: { brand: "Apple", name: "Newton MessagePad", icon: "📝", price: 699,
           note: "launch price, August 1993", verified: "2026-09" },
      b: { brand: "Palm", name: "PalmPilot Personal", icon: "📝", price: 299,
           note: "launch price, March 1997", verified: "2026-09" },
      fact: "Four years later, at under half the price, and without the handwriting recognition everybody made fun of.",
    },
    {
      a: { brand: "Google", name: "Glass, Explorer Edition", icon: "🕶️", price: 1500,
           note: "Explorer programme price, shipping from April 2013", verified: "2026-09" },
      b: { brand: "Apple", name: "Vision Pro", icon: "🥽", price: 3499,
           note: "launch price, February 2024", verified: "2026-09" },
      fact: "Eleven years of progress, and the computer you wear on your face got more expensive, not less.",
    },
    {
      a: { brand: "Apple", name: "iPhone, 8 GB", icon: "📱", price: 599,
           note: "launch price, June 2007 — with a two-year contract", verified: "2026-09" },
      b: { brand: "Apple", name: "iPod, 5 GB", icon: "🎵", price: 399,
           note: "launch price, November 2001", verified: "2026-09" },
      fact: "Six years and two hundred dollars between a thousand songs in your pocket and the thing that made it obsolete.",
    },
    {
      a: { brand: "Microsoft", name: "Xbox", icon: "🎮", price: 299,
           note: "US launch, 15 November 2001", verified: "2026-09" },
      b: { brand: "Nintendo", name: "GameCube", icon: "🎮", price: 199,
           note: "US launch, 18 November 2001", verified: "2026-09" },
      fact: "Three days apart, and a hundred dollars between them. One of these companies had never sold a console before.",
    },
  ],

  /* ---------------------------------------------------------------- TECH */
  /* Current or recent street prices for widely sold hardware, in the same
     spirit as the other categories: plausible, checkable figures rather than
     invented ones. Spread deliberately mixed — three pairs inside 1.3x for the
     near coin-flips, three past 3x for the shocks. */
  tech: [
    {
      a: { brand: "Apple", name: "AirPods Pro 3", icon: "🎵", price: 249,
           note: "retail", verified: "2026-09" },
      b: { brand: "Sony", name: "WH-1000XM6", icon: "🎵", price: 449,
           note: "retail", verified: "2026-09" },
      fact: "Over-ear noise cancelling still costs nearly twice what the earbuds do.",
    },
    {
      a: { brand: "NVIDIA", name: "GeForce RTX 5090 Founders Edition", icon: "🖥️", price: 1999,
           note: "MSRP", verified: "2026-09" },
      b: { brand: "Apple", name: "MacBook Air 13, M4", icon: "💻", price: 999,
           note: "retail", verified: "2026-09" },
      fact: "The graphics card costs two laptops. It is a component.",
    },
    {
      a: { brand: "Sony", name: "PlayStation 5 Pro", icon: "🎮", price: 699,
           note: "retail", verified: "2026-09" },
      b: { brand: "Nintendo", name: "Switch 2", icon: "🎮", price: 449,
           note: "retail", verified: "2026-09" },
      fact: "Two consoles of the same generation, £250 apart in ambition.",
    },
    {
      a: { brand: "Apple", name: "Mac Pro, base tower", icon: "🖥️", price: 6999,
           note: "retail", verified: "2026-09" },
      b: { brand: "Toyota", name: "Corolla, used, 100k miles", icon: "🚗", price: 12000,
           note: "typical used price", verified: "2026-09" },
      fact: "The desktop is not the more expensive one. It is close, which is the problem.",
    },
    {
      a: { brand: "Apple", name: "Pro Display XDR stand", icon: "🖥️", price: 999,
           note: "retail — the stand alone", verified: "2026-09" },
      b: { brand: "Apple", name: "iPad, A16", icon: "📱", price: 349,
           note: "retail", verified: "2026-09" },
      fact: "The stand. Not the monitor, the stand. It costs nearly three iPads.",
    },
    {
      a: { brand: "Steam", name: "Deck OLED, 1TB", icon: "🎮", price: 649,
           note: "retail", verified: "2026-09" },
      b: { brand: "Meta", name: "Quest 3S, 128GB", icon: "🥽", price: 299,
           note: "retail", verified: "2026-09" },
      fact: "A handheld PC costs more than a standalone VR headset now.",
    },
    {
      a: { brand: "Dell", name: "UltraSharp 27 4K", icon: "🖥️", price: 579,
           note: "retail", verified: "2026-09" },
      b: { brand: "LG", name: "C4 OLED 55-inch TV", icon: "📺", price: 1299,
           note: "retail", verified: "2026-09" },
      fact: "A 55-inch OLED television costs more than twice a 27-inch desk monitor. It is also four times the size.",
    },
    {
      a: { brand: "Raspberry Pi", name: "5, 8GB", icon: "🖥️", price: 80,
           note: "retail", verified: "2026-09" },
      b: { brand: "Apple", name: "Polishing Cloth", icon: "🧣", price: 19,
           note: "retail", verified: "2026-09" },
      fact: "A whole computer costs four cloths. This is the correct ratio and it still feels wrong.",
    },
    {
      a: { brand: "Logitech", name: "MX Master 3S", icon: "🖥️", price: 99,
           note: "retail", verified: "2026-09" },
      b: { brand: "Apple", name: "Magic Mouse", icon: "🖥️", price: 99,
           note: "retail", verified: "2026-09" },
      fact: "Identical money. One of them charges from a port on its underside.",
    },
    {
      a: { brand: "NVIDIA", name: "H100 Tensor Core GPU", icon: "🖥️", price: 27000,
           note: "typical single-unit price", verified: "2026-09" },
      b: { brand: "Honda", name: "Civic Si", icon: "🚗", price: 31000,
           note: "MSRP", verified: "2026-09" },
      fact: "One accelerator card, one car. The card is the cheaper of the two and it is close.",
    },
  ],
};
