import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('studio portfolio uses its own media hero and retains its introduction and works', () => {
  const page = fs.readFileSync('src/app/[locale]/portfolio/page.tsx', 'utf8');
  assert.match(page, /<PortfolioHero\s/);
  assert.match(page, /<PortfolioIntro locale=\{locale\} \/>/);
  assert.match(page, /id="works"/);
  assert.doesNotMatch(page, /<PageHero\s/);
  assert.match(page, /artist-razieh-khairipour/);
});
test('hero media is available in the repository', () => {
  for (const file of ['public/images/hero/hero-back.webp', 'public/videos/academy/preview.mp4', 'public/images/portfolios/pf-process.jpg']) {
    assert.ok(fs.statSync(file).size > 0, file);
  }
});
test('hero player does not autoplay and has error feedback and native controls', () => {
  const player = fs.readFileSync('src/components/portfolio/PortfolioHeroVideo.tsx', 'utf8');
  assert.doesNotMatch(player, /\bautoPlay\b/);
  assert.match(player, /controls=\{/);
  assert.match(player, /playsInline/);
  assert.match(player, /role="alert"/);
  assert.match(player, /onError=/);
});
test('portfolio preview offset changes only the desktop video frame dimensions', () => {
  const hero = fs.readFileSync('src/components/portfolio/PortfolioHero.tsx', 'utf8');
  const player = fs.readFileSync('src/components/portfolio/PortfolioHeroVideo.tsx', 'utf8');
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  assert.match(hero, /offsetLeft=\{cfg\.videoOffsetLeft\}/);
  assert.doesNotMatch(hero, /style=\{videoOffsetStyle\}/);
  assert.match(player, /className="portfolio-hero-video-frame/);
  assert.match(css, /@media \(min-width: 1280px\)[\s\S]*?width: calc\(100% \+ var\(--portfolio-video-offset\)\)/);
  assert.match(css, /margin-left: calc\(0px - var\(--portfolio-video-offset\)\)/);
});
test('studio hero does not leak into artist portfolio routes', () => {
  for (const file of ['src/app/[locale]/artists/[slug]/portfolio/page.tsx', 'src/app/[locale]/artists/[slug]/portfolio/[workSlug]/page.tsx']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /PortfolioHero|PortfolioIntro/);
  }
});
