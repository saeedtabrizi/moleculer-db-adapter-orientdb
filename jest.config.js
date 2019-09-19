module.exports = {
  "preset": "ts-jest",
  "testEnvironment": "node",
    "rootDir": "./src",
    "roots": [
      "../test"
    ],
    "coveragePathIgnorePatterns": [
      "/node_modules/",
      "/test/services/"
    ],
    "coverageDirectory": "<rootDir>/coverage",
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js"
    ],
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "testMatch": [
      "**/*.(spec|test).(ts|js)"
    ],
    "globals": {
      "ts-jest": {
        "tsConfig": "tsconfig.test.json"
      }
    }
  }