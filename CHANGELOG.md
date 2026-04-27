## Unreleased

### Added
- Accept `oneliner` and legacy `one` interchangeably when validating works; normalize to `oneliner` and emit soft warnings when both differ.  
- Added `normalizeWork` unit coverage for alias handling and schema acceptance checks for both fields.
- Docs site now ships a Builder-aligned RYB visual system pass and a refreshed playground shell with stock Satie + Praetorius works.
- Playground controls now expose live `theme` mode and `palette` switching against generated output behavior.

### Fixed
- Console skin now loads shared work normalization from a bundled module, eliminating 404 fetches and aligning renders with effective summary fields.  
- Inject a small SVG data-URL favicon during console boot to silence `/favicon.ico` 404s.
- Removed duplicate nav wordmark rendering by disabling default site-title text and using a single brand lockup in the docs header.
