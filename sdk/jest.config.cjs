module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  roots: ["<rootDir>/src"],
  clearMocks: true,
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        diagnostics: false,
      },
    ],
  },
  globals: {
    "ts-jest": {
      diagnostics: false,
    },
  },
};
