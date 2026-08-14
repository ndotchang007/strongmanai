(function () {
  var POSTS = [
    {
      slug: 'progressive-overload-algorithm',
      eyebrow: 'Engineering',
      category: 'Engineering',
      title: 'The progressive overload algorithm, end to end',
      date: 'August 13, 2026',
      readMinutes: 18,
      summary:
        'Every working weight Strongman AI suggests comes from a deterministic engine: last session, readiness, fatigue, double progression, then fatigue hints. This is the full map — formulas, thresholds, diagrams, and decision trees.',
      sections: [
        {
          heading: 'What this document covers',
          paragraphs: [
            'Strongman AI does not invent tonight’s load from a vague “train hard” prompt. The production prescription path is ProgressionEngine.recommend() in shared/progression-engine.js. It reads your last logged performance for that lift, builds a readiness score R, estimates fatigue F̂, computes a decision score D, proposes a double-progression growth target, gates that target with D, then applies fatigue hints.',
            'Separately, the marketing landing page animates a simpler Recovery ≥ 80 model (Sleep + Rest + Meet + RPE leftover) with a fixed +5 lb jump. That demo explains the product story. The live app uses the D-score engine below. Rocky’s AI coach can also suggest loads via /recommend-progress, but those suggestions are LLM-shaped and conservative — they do not replace the deterministic engine in workout mode.',
            'This article documents the production engine completely: every input, constant, formula, branch, and post-adjustment.',
          ],
        },
        {
          heading: 'Pipeline overview',
          diagramLabel: 'Progression pipeline',
          diagramCaption: 'From last session to tonight’s prescription.',
          diagram:
            '<svg viewBox="0 0 720 220" xmlns="http://www.w3.org/2000/svg" font-family="Inter Tight, system-ui, sans-serif">' +
            '<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ff5a1f"/></marker></defs>' +
            '<rect x="8" y="70" width="110" height="56" rx="10" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="63" y="94" text-anchor="middle" fill="#f7f7f8" font-size="12" font-weight="700">Last session</text>' +
            '<text x="63" y="112" text-anchor="middle" fill="#9a9aa2" font-size="10">best set W×R</text>' +
            '<line x1="118" y1="98" x2="148" y2="98" stroke="#ff5a1f" stroke-width="1.5" marker-end="url(#arr)"/>' +
            '<rect x="150" y="70" width="110" height="56" rx="10" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="205" y="94" text-anchor="middle" fill="#f7f7f8" font-size="12" font-weight="700">e1RM</text>' +
            '<text x="205" y="112" text-anchor="middle" fill="#9a9aa2" font-size="10">Epley + RIR 2</text>' +
            '<line x1="260" y1="98" x2="290" y2="98" stroke="#ff5a1f" stroke-width="1.5" marker-end="url(#arr)"/>' +
            '<rect x="292" y="70" width="110" height="56" rx="10" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="347" y="94" text-anchor="middle" fill="#f7f7f8" font-size="12" font-weight="700">R · F̂ · C · D</text>' +
            '<text x="347" y="112" text-anchor="middle" fill="#9a9aa2" font-size="10">scores 0–100</text>' +
            '<line x1="402" y1="98" x2="432" y2="98" stroke="#ff5a1f" stroke-width="1.5" marker-end="url(#arr)"/>' +
            '<rect x="434" y="70" width="120" height="56" rx="10" fill="#16161c" stroke="rgba(255,90,31,.45)"/>' +
            '<text x="494" y="94" text-anchor="middle" fill="#ff5a1f" font-size="12" font-weight="700">Gate on D</text>' +
            '<text x="494" y="112" text-anchor="middle" fill="#9a9aa2" font-size="10">70 / 55 / 40</text>' +
            '<line x1="554" y1="98" x2="584" y2="98" stroke="#ff5a1f" stroke-width="1.5" marker-end="url(#arr)"/>' +
            '<rect x="586" y="70" width="120" height="56" rx="10" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="646" y="94" text-anchor="middle" fill="#f7f7f8" font-size="12" font-weight="700">Hints → final</text>' +
            '<text x="646" y="112" text-anchor="middle" fill="#9a9aa2" font-size="10">sleep · soreness</text>' +
            '<text x="360" y="40" text-anchor="middle" fill="#5c5c65" font-size="11" letter-spacing="1.5">PROGRESSIONENGINE.RECOMMEND()</text>' +
            '<text x="360" y="190" text-anchor="middle" fill="#9a9aa2" font-size="11">Output: weight · reps · sets · action · reasons[] · scores</text>' +
            '</svg>',
          paragraphs: [
            'Callers: WorkoutPredict.predictLoad() for empty sets and new exercises, and the workout tracker’s “Why this weight” focus panel. Units follow imperial (5 lb steps) or metric (2.5 kg) from opts.metric.',
          ],
        },
        {
          heading: 'Step 0 — Calibration when there is no history',
          paragraphs: [
            'If WorkoutSession.getPreviousPerformance(name) returns nothing usable, the engine cannot run double progression. It returns action CALIBRATION with a fallback from WorkoutPredict (or 95 lb / 40 kg × 8 × 3) and D = null. Reason line: “No recent history — starting guess for calibration.”',
          ],
        },
        {
          heading: 'Step 1 — Last session baseline',
          paragraphs: [
            'Previous performance is parsed from logged set lines. Weight matches /(\\d+(?:\\.\\d+)?)\\s*(lb|kg)?/i. Reps match /(\\d+)\\s*[x×]/i or /[x×]\\s*(\\d+)/i. The “best” set is the highest weight; ties break to higher reps. That set becomes oldW × oldR. Set count (≥ 3) later feeds a fatigue hint.',
          ],
        },
        {
          heading: 'Step 2 — Estimated 1RM (Epley)',
          formula:
            'rtf = reps + RIR          // RIR defaults to 2\n' +
            'e1  = weight × (1 + rtf / 30)   // only if weight > 0 and 0 < rtf ≤ 12\n' +
            '// else fallback:\n' +
            'e1  = oldW × 1.25',
          paragraphs: [
            'e1RM sizes the load jump. stepSize uses it so heavier athletes get larger absolute increments (still rounded to plate math).',
          ],
        },
        {
          heading: 'Step 3 — Readiness score R (0–100)',
          paragraphs: [
            'readinessFromUser() reads athleteContext.readiness or todayCheckIn. Only fields that are present participate; weights re-normalize over the present set. If nothing is present, R defaults to a neutral 60.',
          ],
          bullets: [
            'sleepQuality 1–5 → weight 0.20 → s = (quality − 1) / 4',
            'sleepHours → weight 0.10 → s = clamp(hours/8, 0, 1.1) / 1.1',
            'energy 1–5 → weight 0.15 → s = (energy − 1) / 4',
            'stress 1–5 (high is bad) → weight 0.10 → s = (5 − stress) / 4',
            'soreness 1–5 (high is bad) → weight 0.10 → s = (5 − soreness) / 4',
            'R = clamp(100 × Σ(wᵢ·sᵢ) / Σwᵢ, 0, 100)',
          ],
        },
        {
          heading: 'Step 4 — Fatigue estimate F̂ and context C',
          formula:
            'F̂ = soreness ≠ null ? clamp(soreness × 18, 20, 90) : 45\n' +
            'C = 0.5·R + 0.3·(100 − F̂) + 0.2·70\n' +
            '// fixed “baseline” term: 0.2 × 70 = 14 points of C',
          paragraphs: [
            'Momentum is hard-coded at 0.55. Progress prior P is hard-coded at 0.15. These feed D so the engine stays slightly biased toward progress without needing a streak input.',
          ],
        },
        {
          heading: 'Step 5 — Decision score D (0–100)',
          formula:
            'D = 100 × (\n' +
            '  0.30 × ((P + 1) / 2) +     // P=0.15 → 0.1725\n' +
            '  0.25 × (R / 100) +\n' +
            '  0.25 × (1 − F̂ / 100) +\n' +
            '  0.10 × momentum +         // 0.10 × 0.55 = 0.055\n' +
            '  0.10 × (C / 100)\n' +
            ')',
          paragraphs: [
            'D is the single gate for whether tonight overloads, micros, holds, or reduces. It is not the landing-page Recovery sum.',
          ],
        },
        {
          heading: 'Step 6 — Double progression growth target',
          paragraphs: [
            'Before gating, the engine builds the growth target inside the default rep band [repLo, repHi] = [6, 10] (overridable via opts).',
          ],
          formula:
            'if oldR ≥ repHi:\n' +
            '  growthW = oldW + stepSize(e1, metric, momentum)\n' +
            '  growthR = repLo\n' +
            'else:\n' +
            '  growthW = oldW\n' +
            '  growthR = min(repHi, oldR + 1)\n' +
            '\n' +
            'stepSize:\n' +
            '  raw = (e1rm || 100) × 0.02 × (0.5 + momentum)\n' +
            '  minInc = metric ? 2.5 : 5\n' +
            '  return max(minInc, roundTo(raw, minInc))',
          paragraphs: [
            'roundTo(weight, step) = Math.round(weight / step) × step. So when you top out the rep range, load jumps by at least a plate increment; otherwise you add one rep at the same weight.',
          ],
        },
        {
          heading: 'Decision tree — gate on D',
          tree:
            '<span class="tn">START</span>  <span class="dim">(history present)</span>\n' +
            '  │\n' +
            '  ├─ <span class="tok">D ≥ 70</span>  →  <span class="tn">OVERLOAD</span>\n' +
            '  │     nextW, nextR = growthW, growthR\n' +
            '  │     (load up if top of range; else +1 rep)\n' +
            '  │\n' +
            '  ├─ <span class="tok">55 ≤ D &lt; 70</span>  →  <span class="tn">MICRO</span>\n' +
            '  │     nextW = oldW\n' +
            '  │     nextR = min(repHi, oldR + 1)\n' +
            '  │\n' +
            '  ├─ <span class="tok">40 ≤ D &lt; 55</span>  →  <span class="tn">MAINTAIN</span>\n' +
            '  │     nextW, nextR = oldW, oldR\n' +
            '  │\n' +
            '  └─ <span class="tok">D &lt; 40</span>  →  <span class="tn">REDUCE</span>\n' +
            '        nextW = roundTo(oldW × 0.95, minInc)\n' +
            '        nextR = oldR',
          diagramLabel: 'D thresholds',
          diagramCaption: 'Four action bands on the decision score.',
          diagram:
            '<svg viewBox="0 0 720 160" xmlns="http://www.w3.org/2000/svg" font-family="Inter Tight, system-ui, sans-serif">' +
            '<rect x="40" y="48" width="150" height="44" rx="8" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="115" y="68" text-anchor="middle" fill="#9a9aa2" font-size="11">0 – 39</text>' +
            '<text x="115" y="86" text-anchor="middle" fill="#f7f7f8" font-size="13" font-weight="700">REDUCE</text>' +
            '<rect x="200" y="48" width="150" height="44" rx="8" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="275" y="68" text-anchor="middle" fill="#9a9aa2" font-size="11">40 – 54</text>' +
            '<text x="275" y="86" text-anchor="middle" fill="#f7f7f8" font-size="13" font-weight="700">MAINTAIN</text>' +
            '<rect x="360" y="48" width="150" height="44" rx="8" fill="#16161c" stroke="rgba(255,255,255,.12)"/>' +
            '<text x="435" y="68" text-anchor="middle" fill="#9a9aa2" font-size="11">55 – 69</text>' +
            '<text x="435" y="86" text-anchor="middle" fill="#f7f7f8" font-size="13" font-weight="700">MICRO</text>' +
            '<rect x="520" y="48" width="160" height="44" rx="8" fill="#16161c" stroke="rgba(255,90,31,.5)"/>' +
            '<text x="600" y="68" text-anchor="middle" fill="#ff5a1f" font-size="11">70 – 100</text>' +
            '<text x="600" y="86" text-anchor="middle" fill="#ff5a1f" font-size="13" font-weight="700">OVERLOAD</text>' +
            '<text x="360" y="130" text-anchor="middle" fill="#5c5c65" font-size="11">Decision score D</text>' +
            '</svg>',
        },
        {
          heading: 'Step 7 — Fatigue hints (after the gate)',
          paragraphs: [
            'Hints are additive adjustments applied after the D branch. They can stack.',
          ],
          bullets: [
            'last.sets ≥ 3 → SET_FATIGUE: −2.5 lb, −1 rep',
            'sleepHours < 6 → LOW_SLEEP: lbs = −roundTo(5 × (7 − hours), 2.5); reps = −max(1, round(7 − hours))',
            'else if sleepQuality ≤ 2 → LOW_SLEEP_QUALITY: −5 lb, −1 rep',
            'soreness ≥ 4 → HIGH_SORENESS: −5 lb, −1 rep',
            'stress ≥ 4 → HIGH_STRESS: −2.5 lb, 0 reps',
          ],
          formula:
            'nextW = roundTo(max(minInc, nextW + Σ lbs), minInc)\n' +
            'nextR = max(1, nextR + Σ reps)',
        },
        {
          heading: 'Return shape',
          formula:
            '{\n' +
            '  weight, reps, sets, unit, action,\n' +
            '  reasons: string[],\n' +
            '  old: { weight, reps },\n' +
            '  growth: { weight, reps },\n' +
            '  scores: { D, R, F, P, C }\n' +
            '}',
          paragraphs: [
            'action ∈ { CALIBRATION, OVERLOAD, MICRO, MAINTAIN, REDUCE }. reasons[] power the “Why this weight” UI so athletes see the same math the engine used.',
          ],
        },
        {
          heading: 'Worked example',
          paragraphs: [
            'Suppose last best set is 185 × 8, imperial units, no check-in (R = 60), soreness absent (F̂ = 45).',
            'e1 ≈ 185 × (1 + (8+2)/30) = 185 × 1.333… ≈ 246.7. stepSize ≈ max(5, roundTo(246.7 × 0.02 × 1.05, 5)) = max(5, 5) = 5. Because 8 < 10, growth = 185 × 9.',
            'C = 0.5×60 + 0.3×55 + 14 = 30 + 16.5 + 14 = 60.5. D evaluates near the mid-50s depending on exact float — typically MICRO or MAINTAIN territory with neutral readiness — so the engine prefers +1 rep over slamming another plate when recovery is only average. With a strong check-in (high R, low soreness), D climbs past 70 and growth becomes the prescription.',
          ],
        },
        {
          heading: 'Landing-page Recovery model (marketing demo)',
          paragraphs: [
            'The homepage scroll demo uses a different, intentionally simpler rule so the story fits one screen. It is not ProgressionEngine.',
          ],
          formula:
            'hit = (reps ≥ target)\n' +
            'Δ   = hit ? +5 lb : 0\n' +
            '\n' +
            'Sleep    = min(40, sleep_hours × 5)\n' +
            'Rest     = min(30, hours_since_heavy × 0.4)\n' +
            'Meet     = competition_within_48h ? 0 : 20\n' +
            'Leftover = max(0, 10 − (RPE − 6) × 5)\n' +
            '\n' +
            'Recovery = Sleep + Rest + Meet + Leftover\n' +
            '\n' +
            'if hit AND Recovery ≥ 80:\n' +
            '  next = last + Δ\n' +
            'else:\n' +
            '  next = last',
          tree:
            '<span class="tn">LANDING DEMO</span>\n' +
            '  │\n' +
            '  ├─ Target missed? → hold load (Δ = 0)\n' +
            '  │\n' +
            '  └─ Target hit\n' +
            '       ├─ Recovery &lt; 80 → hold load\n' +
            '       └─ Recovery ≥ 80 → last + 5 lb',
          paragraphs: [
            'Demo sheet terms: Last session, Target hit, Sleep /40, Hours since heavy /30, Meet in 48h /20, RPE leftover /10, Recovery /100, Tonight. Example path: 185×5, hit yes, Sleep +38, Rest +28, Meet +20, Leftover +5 → Recovery 91 → 190.',
          ],
        },
        {
          heading: 'AI coach path (non-deterministic)',
          paragraphs: [
            'POST /recommend-progress (progressiveOverloadService) sends historySummary, favoriteMovements, athleteSummary (sport, season, game/meet days, caps), and plannedExercises. The model returns parallel suggestions as sets×reps @ weight with conservative jumps and sport-aware volume cuts. Daily limit: 8. Used from Create’s overload coach and split auto-recommendations — not from the live set-to-set tracker prescription.',
          ],
        },
        {
          heading: 'Related systems',
          bullets: [
            'Workout tracker _goNextSet() advances UI focus; it does not recompute load.',
            'rocky-coaching-insights.detectStalledProgressiveOverload() flags flat/down peaks over ≥10 days for coaching copy only.',
            'projectGoal() estimates weeks to a strength or bodyweight target (~0.75%/week strength, ±1.0 / +0.35 lb/week bodyweight), clamped 1–104 weeks.',
            'ExerciseDatabase.getMinIncrement() controls ± buttons in the UI; engine stepSize uses 5 lb / 2.5 kg unless metric is set.',
          ],
        },
        {
          heading: 'Source of truth',
          paragraphs: [
            'Implementation: secretlair/frontend/shared/progression-engine.js (recommend, readinessFromUser, fatigueHints, stepSize, epleyE1rm, projectGoal). Integration: workout-predict.js, workout-tracker.js, coach-thread.js. Landing demo: STEPS[] inside index.html. Backend AI: progressiveOverloadService.js via routes/recommend.js.',
            'If the copy on the marketing page and the numbers in workout mode ever disagree, trust ProgressionEngine — and this article.',
          ],
        },
      ],
    },
    {
      slug: 'sport-aware-coaching',
      eyebrow: 'Feature',
      category: 'Coaching',
      title: 'Sport-aware coaching that lifts around practice, not over it',
      date: 'July 28, 2026',
      readMinutes: 6,
      summary:
        'Rocky reads sport, season phase, practice nights, and school-night caps so generated sessions complement the week instead of fighting it.',
      sections: [
        {
          heading: 'The problem with generic plans',
          paragraphs: [
            'Most workout apps treat every athlete like a bro-split client with unlimited recovery. Student-athletes do not live that way. Practice nights, game days, and late homework shrink the window for lifting — and a “chest and back” template that ignores that context is how people burn out mid-season.',
            'Strongman AI starts from the opposite assumption: the sport calendar is the source of truth, and strength work has to fit around it.',
          ],
        },
        {
          heading: 'What Rocky actually knows',
          paragraphs: [
            'When you set up an athlete profile, you choose sports, practice nights, meet or game days, and a session cap for school nights. Rocky uses that context when it builds or adjusts a plan — shorter sessions when recovery is thin, complementary lifts that do not duplicate what practice already hammered, and clearer intensity callouts before competition.',
          ],
          bullets: [
            'Sport and season phase inform movement selection and volume',
            'Practice nights and game days reshape the weekly split',
            'School-night caps keep sessions in a realistic 30–45 minute range',
            'Injury notes from the timeline can trigger safer swaps',
          ],
        },
        {
          heading: 'Why this is a product surface, not a prompt trick',
          paragraphs: [
            'The hard part is not asking a model to “consider practice.” It is collecting structured athlete context once, keeping it editable under User settings, and feeding it into every generation path — Home’s daily plan, Coach chat, and Apply-to-workout-mode flows — so the same constraints show up everywhere.',
            'That consistency is what makes sport-aware coaching feel like a coach who remembers your week, not a chatbot that forgot by the next message.',
          ],
        },
      ],
    },
    {
      slug: 'talk-to-rocky',
      eyebrow: 'Feature',
      category: 'Coaching',
      title: 'Talk to Rocky: natural-language workouts with streaming replies',
      date: 'July 24, 2026',
      readMinutes: 5,
      summary:
        'Plain-English prompts become structured plans you can preview, apply to workout mode, or save — while the reply streams in so the session feels alive.',
      sections: [
        {
          heading: 'Ask the way athletes actually talk',
          paragraphs: [
            '“Upper body, forty minutes, machines only, sore left shoulder.” That is a real request. Rocky’s Coach chat is built for that kind of language — not form wizards with twelve dropdowns — and returns a structured workout instead of a wall of prose.',
          ],
        },
        {
          heading: 'From chat to the gym floor',
          paragraphs: [
            'A generated plan is useless if it dies in the chat bubble. Strongman AI treats Coach output as a first-class object: preview the session, apply it into workout mode, or stash it in your split library. Streaming replies make the wait feel like a coach writing on a whiteboard, not a spinner on a loading screen.',
          ],
          bullets: [
            'Streaming UI so sets appear as Rocky drafts them',
            'Apply routine sends the plan straight into workout mode',
            'Save to split library for days you want to repeat',
            'Beginner chips for full-body machine sessions and form tips',
          ],
        },
        {
          heading: 'Guardrails still matter',
          paragraphs: [
            'Natural language is flexible; safety is not optional. Rocky refuses unsafe or ambiguous medical asks and softens intensity when experience is set to Beginner. The goal is fast programming with a coach’s judgment still in the loop.',
          ],
        },
      ],
    },
    {
      slug: 'home-gym-scan',
      eyebrow: 'Feature',
      category: 'Coaching',
      title: 'Scan your home gym: photo inventory for smarter AI plans',
      date: 'July 20, 2026',
      readMinutes: 5,
      summary:
        'Upload equipment photos, compress them client-side, and give Rocky a calibrated inventory — including plate and pin weight mapping — so plans match what you own.',
      sections: [
        {
          heading: 'AI that invents a cable stack you do not have',
          paragraphs: [
            'Home athletes get burned by programs that assume a commercial gym. Strongman AI lets you photograph your setup — up to four shots — so Rocky can reason over a real inventory instead of a fantasy rack.',
          ],
        },
        {
          heading: 'Built for the browser',
          paragraphs: [
            'Photos are compressed on the client before upload to keep the flow snappy on phones. The inventory is not just a label list: plate and pin weight mapping helps Rocky propose loads that map to the equipment you actually touch.',
          ],
          bullets: [
            'Up to four equipment photos per inventory pass',
            'Client-side compression before the request leaves the device',
            'Calibrated inventory Rocky can reference in generation',
            'Plans that respect missing machines instead of pretending they exist',
          ],
        },
        {
          heading: 'The craft angle',
          paragraphs: [
            'This feature is a good example of product engineering meeting model prompting: vision input, careful payload size, structured equipment state, and generation prompts that treat that state as binding constraints — not optional flavor text.',
          ],
        },
      ],
    },
    {
      slug: 'beginner-mode',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'Beginner mode: /learn, machine-first plans, and softer Rocky',
      date: 'July 16, 2026',
      readMinutes: 5,
      summary:
        'Experience-aware coaching for day one — a gym basics guide, machine and cable plans, form cues, and Home nudges that do not dump advanced free-weight programming on new athletes.',
      sections: [
        {
          heading: 'Day one should not feel like a test',
          paragraphs: [
            'Version 1.2 made beginner experience a first-class path. If your profile says Beginner, Rocky defaults to machines and cables, adds form cues, and softens intensity callouts. The /learn guide covers gym basics and starter movements so the app teaches while it programs.',
          ],
        },
        {
          heading: 'Surfaces that reinforce the path',
          paragraphs: [
            'Beginner support is not a single page. Home surfaces a “New to working out? Learn here” callout, Coach chips suggest full-body machine sessions, and workout mode keeps a mini Rocky chat nearby for mid-set form questions.',
          ],
          bullets: [
            'Dedicated guide at /learn with form cues',
            'Experience-aware Rocky plans for Beginner vs. advanced',
            'Softer intensity language when experience is Beginner',
            'Home quick link into the beginner guide',
          ],
        },
        {
          heading: 'Design principle',
          paragraphs: [
            'Progressive disclosure beats dumping the entire product on someone who just walked into a gym. Beginner mode is that principle applied to coaching tone, exercise selection, and navigation — the same athlete can grow into freer programming later without switching apps.',
          ],
        },
      ],
    },
    {
      slug: 'workout-mode',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'Workout mode without a rest timer: time since last set',
      date: 'July 12, 2026',
      readMinutes: 5,
      summary:
        'A focused session UI for weight, dropsets, and supersets — with elapsed time between sets instead of a countdown, plus in-session Rocky for form cues.',
      sections: [
        {
          heading: 'Countdown timers fight real gyms',
          paragraphs: [
            'Commercial gyms are chaotic. A hard rest timer that screams at you while someone is still on your bench is more stress than coaching. Strongman AI’s workout mode shows time since last set instead — awareness without a false deadline.',
          ],
        },
        {
          heading: 'What the session UI owns',
          paragraphs: [
            'Workout mode is a full-screen flow for logging per-set weight, dropsets, and supersets. Apply routine pulls a Rocky plan straight in. When form questions show up mid-session, a mini Rocky chat answers without forcing you to abandon the log.',
          ],
          bullets: [
            'Time since last set replaces the rest-timer overlay',
            'Per-set logging with dropset and superset support',
            'Apply routine from Coach into the active session',
            'In-workout Rocky mini chat for quick cues',
          ],
        },
        {
          heading: 'Small details, cleaner finish',
          paragraphs: [
            'Session duration now records correctly when you finish, and the legacy rest-timer UI is gone. Auto-save rest time was removed because elapsed time is already persisted as you train — fewer settings, fewer surprises.',
          ],
        },
      ],
    },
    {
      slug: 'session-analytics',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'From diary to dashboard: session analytics that stay in the app',
      date: 'July 8, 2026',
      readMinutes: 6,
      summary:
        'Logged sets power Chart.js tiles for volume, peak load, e1RM, frequency, and intensity — plus a plain-language strength overview for the range you pick.',
      sections: [
        {
          heading: 'Logging is only half the product',
          paragraphs: [
            'Athletes already know how to write numbers in a notes app. The value is turning those sets into a readable story: Is volume climbing? Is peak load stuck? Are you showing up enough weeks in a row?',
          ],
        },
        {
          heading: 'What the dashboard surfaces',
          paragraphs: [
            'Post-workout and timeline views use draggable Chart.js tiles so you can rearrange the story you care about. Metrics include volume over time, peak load, Epley estimated 1RM, session frequency, and subjective intensity — capped with a plain-language strength overview for the selected range.',
          ],
          bullets: [
            'Volume and peak-load trends without exporting CSV',
            'Epley e1RM estimates from working sets',
            'Session frequency and intensity context',
            'Rocky generating animation that bridges finish → insight',
          ],
        },
        {
          heading: 'Why keep analysis in-product',
          paragraphs: [
            'Export-to-spreadsheet workflows break the loop between coach advice and measured progress. Keeping charts next to Rocky and the leaderboard means the same session data fuels coaching, ranking, and reflection — one log, many surfaces.',
          ],
        },
      ],
    },
    {
      slug: 'rank-leaderboards',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'Rank: exercise boards, streaks, timed events, and head-to-head',
      date: 'July 4, 2026',
      readMinutes: 5,
      summary:
        'Global, Friends, and Followers filters across lift boards, streak rankings, timed events, and email-invite competitions with post-workout check-ins.',
      sections: [
        {
          heading: 'Competition that fits real sports',
          paragraphs: [
            'Not every PR is a barbell number. Rank includes exercise leaderboards with database-validated lift search, streak boards for consistency, and timed-event boards for running and swimming — so the Rank tab feels like an athletic scoreboard, not only a powerlifting list.',
          ],
        },
        {
          heading: 'Social scope without losing focus',
          paragraphs: [
            'Global / Friends / Followers filters let athletes zoom from the world to their circle. Head-to-head competitions use email invites and post-workout check-ins so rivalries stay tied to real logged sessions.',
          ],
          bullets: [
            'Lift search with validation and suggestions',
            'Streak rankings for showing up',
            'Timed boards for running and swimming',
            'Weights display in preferred units (lb or kg)',
          ],
        },
        {
          heading: 'Public by design',
          paragraphs: [
            'Leaderboards remain viewable without signing in — a deliberate growth surface. Logged-in athletes get the richer filters and competition tools; visitors still see the competitive pulse of the product.',
          ],
        },
      ],
    },
    {
      slug: 'instagram-story-stickers',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'Instagram Story stickers from the browser',
      date: 'June 30, 2026',
      readMinutes: 4,
      summary:
        'After a workout or PR, customize a transparent PNG sticker on canvas — exercises, intensity, notes — and share it to Stories, including a one-tap mobile path.',
      sections: [
        {
          heading: 'Training culture lives on Stories',
          paragraphs: [
            'Athletes already screenshot dumbbell racks and type PRs into Instagram. Strongman AI meets that habit with a first-party sticker flow: canvas-generated transparent PNGs that look intentional instead of cropped UI.',
          ],
        },
        {
          heading: 'Customize, preview, share',
          paragraphs: [
            'Pick which exercises, intensity, and notes appear. Preview updates live on canvas. On mobile, a one-tap path with Instagram connect keeps friction low after you finish a hard session.',
          ],
          bullets: [
            'Canvas-rendered transparent PNGs',
            'Strava-style session sticker layout',
            'PR and workout share entry points',
            'Mobile-friendly handoff into Instagram Stories',
          ],
        },
        {
          heading: 'Portfolio note',
          paragraphs: [
            'This feature is pure front-end craft: canvas compositing, share-sheet quirks, and a shareable artifact that makes the product visible outside the app — useful growth and a sharp demo of browser capability.',
          ],
        },
      ],
    },
    {
      slug: 'theme-system',
      eyebrow: 'Engineering',
      category: 'Engineering',
      title: 'Seven named themes: a CSS custom-property palette system',
      date: 'June 26, 2026',
      readMinutes: 5,
      summary:
        'Ember, Daylight, Voltage, Forge, Aurora, and mono variants persist across the app via theme.js — with Settings as a clean appearance hub separate from athlete prefs.',
      sections: [
        {
          heading: 'One token layer, many looks',
          paragraphs: [
            'Strongman AI does not ship seven separate stylesheets. A single token layer in theme.css defines backgrounds, accents, and text colors; html[data-theme="…"] swaps the palette. theme.js persists the choice to localStorage and respects system preference when asked.',
          ],
        },
        {
          heading: 'Settings vs. User settings',
          paragraphs: [
            'Version 1.1 split appearance and Labs into Settings, while sports, schedule, and account details live under You. That separation keeps “make it look like me” away from “program my week” — clearer IA, easier demos.',
          ],
          bullets: [
            'Named themes: Ember, Daylight, Voltage, Forge, Aurora, mono variants',
            'CSS custom properties as the single source of color',
            'Persistence through theme.js + localStorage',
            'Labs experimental mode beside appearance controls',
          ],
        },
        {
          heading: 'Why it matters for a portfolio',
          paragraphs: [
            'Theme systems are where design tokens meet real product constraints. Shipping multiple palettes without forking components is a clean signal of front-end discipline — and athletes notice when the app feels like theirs.',
          ],
        },
      ],
    },
    {
      slug: 'surveys-hub',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'Surveys hub: public feedback that shapes the roadmap',
      date: 'June 22, 2026',
      readMinutes: 4,
      summary:
        'A gallery of structured surveys for bugs, exercise requests, and roadmap wants — same card language later reused for version history and this blog.',
      sections: [
        {
          heading: 'Feedback without a support ticket maze',
          paragraphs: [
            'Athletes should not need a Discord mod to request a movement or flag a bug. The Surveys hub is a public gallery of structured forms — feedback, exercises, wants — so input lands in a shape the team can act on.',
          ],
        },
        {
          heading: 'A shared UI language',
          paragraphs: [
            'The survey card gallery became a reusable pattern: version history and the blog use the same rhythm of eyebrow, date, title, summary, and CTA. That consistency is intentional — one visual system for “things you can open and read or fill out.”',
          ],
          bullets: [
            'Structured surveys for bugs, exercises, and roadmap',
            'Public access without forcing a full login wall',
            'Card gallery pattern shared with Versions and Blog',
            'Backend routes that persist submissions for review',
          ],
        },
        {
          heading: 'Closing the loop',
          paragraphs: [
            'Surveys only matter if they change the product. Several 1.1 and 1.2 items — beginner guide, clearer settings, leaderboard validation — came from the same feedback channels Surveys now formalizes.',
          ],
        },
      ],
    },
    {
      slug: 'daily-plan-home',
      eyebrow: 'Feature',
      category: 'Product',
      title: 'Daily plan on Home: split day, sport schedule, injury-aware swaps',
      date: 'June 18, 2026',
      readMinutes: 5,
      summary:
        'First login of the day surfaces a contextual plan from your weekly split, competition countdown, timeline injuries, and Rocky setup alerts.',
      sections: [
        {
          heading: 'Open the app, know the day',
          paragraphs: [
            'Home is not a blank dashboard waiting for you to invent a session. On the first login of the day, Strongman AI surfaces a contextual training plan — what the split says, what the sport calendar implies, and whether anything on the timeline should change the prescription.',
          ],
        },
        {
          heading: 'Context that stacks',
          paragraphs: [
            'The plan composes signals instead of picking one: weekly split day, competition countdowns, injury notes, and Rocky setup alerts when sports or schedule are missing. New athletes who have not logged yet also get a coaching nudge toward their first session or the beginner guide.',
          ],
          bullets: [
            'Split-aware daily recommendation',
            'Competition countdown awareness',
            'Injury-aware exercise swaps from timeline data',
            'Setup alerts when profile context is incomplete',
          ],
        },
        {
          heading: 'The hub everything else hangs on',
          paragraphs: [
            'Daily plan is the connective tissue between Coach, Log, Rank, and You. Get this surface right and the rest of the app feels like a system; get it wrong and every feature is a separate tool. That is why Home keeps earning polish each release.',
          ],
        },
      ],
    },
    {
      slug: 'pwa-and-install',
      eyebrow: 'Engineering',
      category: 'Engineering',
      title: 'Shipping a training app as a PWA-ready web product',
      date: 'June 14, 2026',
      readMinutes: 5,
      summary:
        'Static pages on GitHub Pages, an API on Render, a service worker, and a landing install overlay that previews the add-to-home-screen path.',
      sections: [
        {
          heading: 'Web first, install when it counts',
          paragraphs: [
            'Strongman AI ships as a multi-page web app with clean URLs, a service worker, and a landing-page install preview that walks through device check → prepare package → add to home screen. The product is usable in the browser today while the install story stays honest about what is live versus coming soon.',
          ],
        },
        {
          heading: 'Architecture in one breath',
          paragraphs: [
            'The frontend is static HTML, CSS, and vanilla JS — no framework tax on first paint. The Express API on Render owns auth, coaching, tracking, and surveys against PostgreSQL. Clean URL maps live in three places on purpose: Express routes, GitHub Pages redirects, and a small client router for dynamic slugs.',
          ],
          bullets: [
            'GitHub Pages frontend + Render API',
            'Service worker for progressive enhancement',
            'Clean URLs for /home, /blog/:slug, /versions/:slug',
            'Install overlay as a product education surface',
          ],
        },
        {
          heading: 'Why this stack for a portfolio',
          paragraphs: [
            'Framework demos are common. A full product with auth, AI coaching, analytics, themes, and public marketing pages — all wired by hand with careful routing — shows end-to-end web craft. That is the point of documenting features here.',
          ],
        },
      ],
    },
    {
      slug: 'v1-2-beginner-coaching',
      eyebrow: 'Release',
      category: 'Release',
      title: 'Version 1.2: coaching that meets beginners where they are',
      date: 'July 10, 2026',
      readMinutes: 3,
      summary:
        'Release notes for the beginner guide, simplified workout mode, experience-aware Rocky plans, and richer post-workout summary.',
      sections: [
        {
          heading: "What's new",
          paragraphs: [
            'Version 1.2 focuses on athletes who are new to the gym. Rocky builds beginner-friendly sessions with machines and cables, surfaces form cues mid-workout, and ships a dedicated guide at /learn.',
          ],
          bullets: [
            'Beginner guide with starter machine exercises and form cues',
            'Experience-aware Rocky workouts',
            'Workout mode simplified around time since last set',
            'In-workout Rocky mini chat and post-workout volume charts',
          ],
        },
        {
          heading: 'Read the deep dives',
          paragraphs: [
            'For longer product stories, see the Beginner mode and Workout mode articles on this blog. Full structured patch notes live in Version history.',
          ],
        },
      ],
    },
    {
      slug: 'v1-1-settings-and-guide',
      eyebrow: 'Release',
      category: 'Release',
      title: 'Version 1.1: clearer settings, a how-to guide, and Surveys',
      date: 'June 29, 2026',
      readMinutes: 3,
      summary:
        'Release notes for the Settings split, /info guide, Labs experimental mode, Surveys hub, and DM Sans app shell.',
      sections: [
        {
          heading: "What's new",
          paragraphs: [
            'Version 1.1 cleaned up the app shell: Settings for appearance and Labs, User settings under You for athlete context, a how-to guide at /info, and the Surveys hub for structured feedback.',
          ],
          bullets: [
            'Settings hub vs. User settings under You',
            'How-to guide at /info',
            'Version history and catch-up for returning athletes',
            'Surveys hub and DM Sans typography pass',
          ],
        },
        {
          heading: 'Read the deep dives',
          paragraphs: [
            'See the Surveys hub and Theme system articles for the longer stories behind this release. Structured patch notes remain on Version history.',
          ],
        },
      ],
    },
    {
      slug: 'welcome-to-the-blog',
      eyebrow: 'Journal',
      category: 'Journal',
      title: 'A journal for the systems behind Strongman AI',
      date: 'August 1, 2026',
      readMinutes: 3,
      summary:
        'Feature write-ups, shipping notes, and engineering context — how we build sport-aware training software on the open web.',
      sections: [
        {
          heading: 'What you will find here',
          paragraphs: [
            'This blog is part product changelog, part engineering journal. Feature articles explain how coaching, logging, Rank, themes, and install flows work. Release posts point at Version history when you want every bullet.',
            'If you are here for a portfolio read: start with sport-aware coaching, workout mode, session analytics, and the PWA architecture note — then poke the live product.',
          ],
        },
        {
          heading: 'How to stay current',
          bullets: [
            'Blog — feature stories and release context',
            'Version history — structured patch notes',
            'Surveys — feedback that shapes the roadmap',
          ],
        },
      ],
    },
  ];

  function sortByDateDesc(a, b) {
    return Date.parse(b.date) - Date.parse(a.date);
  }

  function list() {
    return POSTS.slice().sort(sortByDateDesc);
  }

  function get(slug) {
    if (!slug) return null;
    var key = String(slug).toLowerCase();
    for (var i = 0; i < POSTS.length; i++) {
      if (POSTS[i].slug === key) return POSTS[i];
    }
    return null;
  }

  function featured() {
    var latest = 'progressive-overload-algorithm';
    return get(latest) || list()[0] || null;
  }

  function updates() {
    return list().filter(function (p) {
      var cat = String(p.category || p.eyebrow || '').toLowerCase();
      return cat === 'release' || cat === 'update' || cat === 'journal';
    });
  }

  window.BLOG_CATALOG = {
    list: list,
    get: get,
    featured: featured,
    updates: updates,
    latest: 'progressive-overload-algorithm',
  };
})();
