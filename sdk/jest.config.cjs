module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/test/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  roots: ["<rootDir>/src", "<rootDir>/test"],
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
