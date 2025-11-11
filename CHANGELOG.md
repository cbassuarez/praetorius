## Unreleased

### Added
- Accept `oneliner` and legacy `one` interchangeably when validating works; normalize to `oneliner` and emit soft warnings when both differ.  
- Added `normalizeWork` unit coverage for alias handling and schema acceptance checks for both fields.

### Fixed
- Console skin now loads shared work normalization from a bundled module, eliminating 404 fetches and aligning renders with effective summary fields.  
- Inject a small SVG data-URL favicon during console boot to silence `/favicon.ico` 404s.
