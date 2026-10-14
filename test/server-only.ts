// Stands in for the `server-only` package under Vitest. The real one throws
// on import outside Next's react-server build, which is the point in the app
// but makes server modules untestable.
export {};
