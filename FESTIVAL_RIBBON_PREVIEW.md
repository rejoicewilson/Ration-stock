# Festive ribbon: manual seasonal selection

The manual choice in `react _frontend/src/festivalConfig.js` is currently:

```js
export const ACTIVE_FESTIVAL = 'navratri';
```

After deployment, Navratri/Pooja appears only on Home, in the same 40px space
between the account header and shop banner. It has a Malayalam greeting, glowing
nilavilakku, marigold flowers and drifting petals. There is no Play/Pause control.
Motion pauses when the page is hidden and respects device reduced-motion settings.

No Display settings icon is shown beside FPS. Device reduced-motion settings and
previously saved browser motion preferences remain respected. Feature forms,
payment screens and the owner dashboard are unchanged.

There is **no automatic scheduling**. After the season, set `ACTIVE_FESTIVAL` to
`null` and redeploy to hide the ribbon and restore the usual spacing. Set it to
`'christmas'` and redeploy when that season arrives. No database changes or new
environment variables are required.

With the usual local frontend/backend servers running, development overrides are:

- `http://localhost:5173/?festival-preview=navratri`
- `http://localhost:5173/?festival-preview=christmas`
- `http://localhost:5173/?festival-preview=none`

Production ignores URL overrides and follows only `ACTIVE_FESTIVAL`. Other festival
artwork and automatic scheduling are not implemented. Feature forms, payment
screens and the owner dashboard do not show the ribbon.

Local browser check (mock account, no live feature requests):

`node tools/test-festival-ribbon.mjs`
