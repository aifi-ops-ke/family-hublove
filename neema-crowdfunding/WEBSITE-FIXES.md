# neemaprostudios.com: approved changes

Approved by the studio on 30 Sep 2026. Hand this list to whoever maintains the website.

Most portfolio items (partners, projects, artists) probably come from the **admin panel**
(`/admin` → Portfolio / Clients / Artists / Releases), not from the page code.
Change them there first. If an item isn't in the admin panel, change it in the code.

---

## 1. Remove two partners (Portfolio page)

Section **"Organizations & Institutional Clients"**:

- [ ] Delete **Safaricom Media Hub**
- [ ] Delete **Sauti Sol Entertainment Ltd**
- [ ] Keep **Mavuno Church Nairobi** and **Wanavokali Ensemble**

Section **"Full-Lifecycle Studio Projects"**: projects `#NPS-PRJ-2026-001` and
`#NPS-PRJ-2026-003` show "🏢 Sauti Sol Entertainment Ltd" as the organisation.
Remove that organisation from both projects.

> Leave "Safaricom PLC" on the **Privacy** page. It correctly names M-Pesa as your payment processor.

## 2. Equipment wording (Home, About, Services)

The equipment is real. No removals are needed. Optional: add a line wherever the
equipment is listed, to link it to the campaign:

> "We're upgrading and expanding our studio equipment. Support Sauti ya Neema →" (link to `/become-sponsor`)

## 3. Remove "Matatu Groove" everywhere

| Page | Where |
|---|---|
| Home | Hero audio player card: **"Matatu Groove (Master Mix)"**. Swap in a real track, or remove the player |
| Music | Track **"Matatu Groove (Club Mix)"** by DJ Xpress & Sylvester |
| Portfolio | Project **#NPS-PRJ-2026-003 "Matatu Groove" 4K Cinematic Music Video** |
| Book | Form placeholder text: `e.g. Matatu Groove (Single) or Neema Live Praise`. Change it to `e.g. Neema Live Praise` |

## 4. Fix a name spelling

The artist list is correct. Only the spelling needs fixing:

- [ ] **"Raphael obaga" → "Raphael Ombaga"** (the spelling used on the About page)
  - Become a Sponsor page → "Choose or Enter Artist Name" dropdown
  - Portfolio page → "Featured Artist Roster" (the initials badge "RA" is fine)

## 5. Remove the tax-exemption box (Become a Sponsor page)

In `become-sponsor`, delete this whole block, which sits just above the "Confirm Sponsorship Pledge" button:

```html
<div class="p-4 rounded-xl bg-studio-bg border border-emerald-500/30 flex items-start gap-3">
  <span class="text-emerald-400 text-lg">✓</span>
  <div>
    <p class="font-bold text-white">KRA Tax Exemption &amp; eTIMS Certification</p>
    <p class="text-[11px] text-gray-400">All sponsorships qualify as creative philanthropic investments under Kenyan law. An official KRA eTIMS control code certificate will be dispatched upon pledge confirmation.</p>
  </div>
</div>
```

Optional replacement, which makes no tax claim:

```html
<div class="p-4 rounded-xl bg-studio-bg border border-emerald-500/30 flex items-start gap-3">
  <span class="text-emerald-400 text-lg">✓</span>
  <div>
    <p class="font-bold text-white">Official Receipt</p>
    <p class="text-[11px] text-gray-400">You will receive an official receipt for your sponsorship once your payment is confirmed.</p>
  </div>
</div>
```

## 6. Add more projects to the Portfolio

The homepage shows **140+ sessions, 50+ artists & choirs and 95+ master projects**,
but the Portfolio shows only 3 projects and 3 artists. Add real projects in the
admin panel so the Portfolio matches the homepage. Cover each service the homepage offers:

| Service (from homepage) | Add at least |
|---|---|
| Audio tracking & vocals | 2–3 recordings (e.g. **Neema Pro Studios Choir: "Kwa Neema Tu"**) |
| Music video production | 2 videos (link the YouTube videos) |
| Live concert & church event coverage | 2 events (e.g. Mavuno Worship Live Concert, already listed) |
| Mixing & mastering | 1–2 songs |
| Music distribution | 1–2 releases with real Spotify / Boomplay links |

For each project, enter: **title · artist or client · church/organisation · service · month/year · status · link**.

Also update the counters at the top of the Portfolio page (currently "3+ projects, 1+ release,
4+ partners, 3+ creators") so they match the homepage numbers, or change the homepage numbers to match reality.

## Other fixes from the site check (not yet approved)

- [ ] `sitemap.xml` and `robots.txt` use `http://localhost/neemastudio/public_html/`. Change to `https://neemaprostudios.com/`
- [ ] Portfolio "Spotify →" button links to `open.spotify.com/album/example123`
- [ ] Browser-tab titles show `&amp;` / `&bull;` (double-escaped) on Terms, Privacy, Portfolio, GDPR, Music Rights and Book
- [ ] Homepage heading needs a space: "Cannot Afford Studio Time? We Have Got You Covered."
- [ ] Opening hours differ between the homepage, the footer and the Contact page
- [ ] Logo text "Neema Pro Studio" should read "Neema Pro Studios"
- [ ] Emails use `@neemastudios.com` but the website is `neemaprostudios.com`
